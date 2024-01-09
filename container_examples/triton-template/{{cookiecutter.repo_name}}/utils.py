# importing importlib.util module
import importlib.util
import argparse
import os
import shutil
import sys
import tarfile
import requests
from python_on_whales import Image, docker
from huggingface_hub import snapshot_download


BUILD_IMAGE_TAG = "conda_env_builder:latest"
DIST_PATH = "dist"
DEFAULT_MODEL_NAME = "{{cookiecutter.model_name}}"
ARTIFACTS_PATH = os.path.join(DIST_PATH, "models", DEFAULT_MODEL_NAME, "/1/artifacts")
ENV_PATH = os.path.join(DIST_PATH, DEFAULT_MODEL_NAME)
CONDA_TAR_NAME = "triton-custom-env.tar.gz"
CONDA_TAR_PATH = os.path.join(ENV_PATH, CONDA_TAR_NAME)

FLAGS = None


# helper functions
def log(msg, force=False):
    if force or not FLAGS.quiet:
        try:
            print(msg, file=sys.stderr)
        except Exception:
            print("<failed to log>", file=sys.stderr)


def log_verbose(msg):
    if FLAGS.verbose:
        log(msg, force=True)


def fail(msg):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(1)


def fail_if(p, msg):
    if p:
        fail(msg)


# def download_from_gstore(url, local_dir):
#     pass


# def download_from_s3(url, local_dir):
#     pass


def download_from_url(url, local_path):
    log_verbose(f"Downloading {url} to {local_path}.")
    local_filename = url.split("/")[-1]
    file_path = os.path.join(local_path, local_filename)
    create_dir(local_path)
    with requests.get(url, stream=True, allow_redirects=True, timeout=300) as request:
        request.raise_for_status()
        with open(
            file=file_path,
            mode="wb",
        ) as file:
            # Might be faster ?
            # shutil.copyfileobj(request.raw, file)
            for chunk in request.iter_content(chunk_size=8192):
                # If you have chunk encoded response uncomment if
                # and set chunk_size parameter to None.
                # if chunk:
                file.write(chunk)
    return file_path


def _dynamic_module_import(name):
    # code to check if the library exists
    if (spec := importlib.util.find_spec(name)) is not None:
        # displaying that the module is found
        print(f"{name!r} already in sys.modules")
        # importing the present module
        module = importlib.util.module_from_spec(spec)
        sys.modules[name] = module
        spec.loader.exec_module(module)
        # displaying that the module has been imported
        print(f"{name!r} has been imported")
        return True
    # else displaying that the module is absent
    else:
        print(f"can't find the {name!r} module")
        return False


def store_spacy_artifacts(model_name, output_dir, version=None, tmp_dir=".tmp"):
    """Downloads and stores spacy models/pipelines from spacy's github releases this allows
    for any model of any version to be downloaded and saved to a specific directory without
    the need to install spacy or save the models in pip.

    This separates the need to rebuild a conda-pack whenever a model is changed for serving
    inference.

    Args:
        model_name (string): The name of a spacy model/pipeline
        local_dir (str): The output path of where to save the downloaded model(s)
        version (str, optional): A string denoting a version of a spacy model. If no version is provided will attempt to use spacy (if installed) to determine the latest version of model_name. Example: 3.7.0. Defaults to None.
        tmp_dir (str, optional): A temp directory used to download and extract the tar.gz release from github. Defaults to ".tmp".
    """
    if version is None and _dynamic_module_import("spacy"):
        import spacy # pylint: disable=import-outside-toplevel

        version = spacy.cli.info(model_name).get("version")

    fail_if(
        version is None,
        f"Must specify a version of spacy model, run: spacy info {model_name}",
    )

    full_name = f"{model_name}-{version}"
    log(f"Attempting to download spacy pipeline: {full_name}")

    file_path = download_from_url(
        f"https://github.com/explosion/spacy-models/releases/download/{full_name}/{full_name}.tar.gz",
        tmp_dir,
    )
    with tarfile.open(file_path, "r:gz") as tar:
        tar.extractall(tmp_dir)

    # NOTE: Extracts sub folders with model config
    # f"./{tmp_dir}/{model_name}-{version}/{model_name}/{model_name}-{version} -> ./{output_dir}/{model_name}"
    shutil.copytree(
        os.path.join(tmp_dir, full_name, model_name, full_name),
        os.path.join(output_dir, full_name),
        dirs_exist_ok=True,
    )

    # NOTE: Remove temp directory
    delete_dir(tmp_dir)

    log_verbose(f"Downloaded {model_name} to: {output_dir}.")
    return output_dir


def download_hf_artifacts(repo_name, local_dir, force=False):
    log(f"Attempting to download huggingface repo: {repo_name}")

    if os.path.exists(local_dir) and len(os.listdir(local_dir)) > 1 and force is False:
        log_verbose(
            f"Found local download of {repo_name} at: {local_dir}. Skipping download"
        )
        return local_dir

    create_dir(local_dir)
    log_verbose(
        f"Local download of {repo_name} not found at: {local_dir}, downloading."
    )
    snapshot_download(repo_name, local_dir=local_dir, local_dir_use_symlinks=False)

    return local_dir


def create_conda_pack(
    src_input="./src/environment",
    output_name="triton-custom-env.tar.gz",
    output_dir="",
    builder_tag="",
    force_rebuild=False,
):
    log(f"Attempting to create conda_pack tar file: {output_dir}")
    _path = os.path.join(output_dir, output_name)
    if os.path.exists(_path) is False and force_rebuild is False:
        create_dir(output_dir)
        log_verbose(
            f"Local download of {output_dir} creating conda pack tar and downloading."
        )
        conda_env_builder = (
            docker.build(
                f"{src_input}",
                file=f"{src_input}/Dockerfile.build",
                tags=builder_tag,
                progress="plain",
            )
            > Image
        )
        conda_env_builder.copy_from(
            path_in_image="/envs/triton-custom-env.tar.gz", destination=_path
        )
        conda_env_builder.copy_from(
            path_in_image="/envs/environment.yml", destination=DIST_PATH
        )
        return _path

    log_verbose(f"Found local download of {_path}. Skipping creation/download.")
    return _path


def delete_build_image(image_tag):
    # Remove build image
    fail_if(
        docker.image.exists(image_tag) is False, f"No image found for tag: {image_tag}"
    )
    log(f"Deleting conda pack build image: {image_tag}")
    if docker.image.exists(image_tag):
        docker.image.remove(image_tag)


def delete_dir(dir_path):
    log("Deleting dist folder.")
    if os.path.exists(dir_path):
        log_verbose(f"Deleting {dir_path}")
        shutil.rmtree(dir_path)


def create_dir(dir_path):
    if os.path.exists(dir_path) is False:
        log_verbose(f"Creating dir: {dir_path}")
        os.makedirs(dir_path)


def src_copy(input_path, output_path, filter_on):
    for _dir in os.listdir(input_path):
        if _dir in filter_on:
            copy_dir(os.path.join(input_path, _dir), os.path.join(output_path, _dir))


def copy_dir(input_path, output_path):
    log_verbose(f"Copying: {input_path} -> {output_path}")
    shutil.copytree(input_path, output_path, dirs_exist_ok=True)
    # shutil.copytree(os.path.join("src", "question_and_answer"), dest, dirs_exist_ok=True)


def list_models(host="localhost", port="8080", protocol="http"):
    endpoint = f"{protocol}://{host}:{port}/v2/repository/models/index"
    response = requests.post(endpoint, timeout=10)
    if response.status_code != 200:
        print(response.text)
    return response


def unload_model(model_name, host="localhost", port="8080", protocol="http"):
    log(f"Unloading model: {model_name}")
    endpoint = f"{protocol}://{host}:{port}/v2/repository/models/{model_name}/unload"
    response = requests.post(endpoint, timeout=300)
    if response.status_code != 200:
        print(response.text)
    return response


def load_model(model_name, host="localhost", port="8080", protocol="http"):
    log(f"Loading model: {model_name}")
    endpoint = f"{protocol}://{host}:{port}/v2/repository/models/{model_name}/load"
    response = requests.post(endpoint, timeout=300)
    if response.status_code != 200:
        print(response.text)
    return response


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="A set of commands to help create deployable packages for model inference on Nvidia Triton Servers.",
        usage="%(prog)s [options]",
        exit_on_error=True,
    )
    group_qv = parser.add_mutually_exclusive_group()
    group_qv.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        required=False,
        help="Disable console output.",
    )

    group_qv.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        required=False,
        help="Enable verbose output.",
    )

    parser.add_argument(
        "action",
        type=str,
        action="store",
        default="help",
        help="Main action to perform: build, download, clean",
    )

    parser.add_argument(
        "-o",
        "--output",
        type=str,
        required=False,
        help=f"The local path for download request. Default is: {DIST_PATH}.",
    )

    parser.add_argument(
        "--conda-build-clean",
        action="store_true",
        required=False,
        help="Removes the docker image used to create the conda-pack tar",
    )

    parser.add_argument(
        "-c",
        "--clean",
        action="store_true",
        required=False,
        help="Removes model artifacts and conda-pack tars from the current model directory",
    )

    parser.add_argument(
        "-hf",
        "--hf-repo",
        type=str,
        required=False,
        help=f"Given a repo id downloads HuggingFace model snapshot to to {ARTIFACTS_PATH} or --output location.",
    )
    spacy_args = parser.add_argument_group("Spacy Model Download")
    spacy_args.add_argument(
        "-spcy",
        "--spacy-model",
        type=str,
        required=False,
        help=f"Given a  model snapshot to to {ARTIFACTS_PATH} or --output location.",
    )
    spacy_args.add_argument(
        "--model-version",
        type=str,
        required=False,
        help="(Optional) Specify a specific version of a spacy model to download. Default is latest",
    )

    parser.add_argument(
        "-d",
        "--download",
        type=str,
        required=False,
        help="A url of a publicly available object to download",
    )

    parser.add_argument(
        "-dist",
        "--distribution-name",
        type=str,
        required=False,
        help="The name of the model folder in a build",
    )

    parser.add_argument(
        "--list",
        action="store_true",
        required=False,
        help="List models and status in a triton model repo.",
    )

    parser.add_argument(
        "--load",
        type=str,
        required=False,
        help="The name of a model to load into a running triton server (most be in the triton model repo.)",
    )

    parser.add_argument(
        "--unload",
        type=str,
        required=False,
        help="The name of a model to unload into a running triton server (most be in the triton model repo.)",
    )

    parser.add_argument(
        "-i",
        "--input",
        type=str,
        required=False,
        help="The name of the source model folder to build from. Defaults to: ./src",
    )

    parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        required=False,
        help="Force an artifact to re-download.",
    )

    parser.add_argument(
        "--skip", type=str, required=False, help="Skip a step(s) of the build process."
    )

    try:
        FLAGS = parser.parse_args()
    except Exception as error:
        FLAGS = parser.parse_args(["help"])

    if FLAGS.action == "help":
        parser.print_help()

    if FLAGS.action == "build":
        if FLAGS.output is None:
            FLAGS.output = DIST_PATH

        models_dir = os.path.join(FLAGS.output, "models")
        if FLAGS.distribution_name is not None:
            models_dir = os.path.join(FLAGS.output, "models", FLAGS.distribution_name)

        create_dir(models_dir)
        conda_tar_dir = os.path.join(FLAGS.output, "envs")

        if FLAGS.input is not None:
            src_copy(
                input_path=FLAGS.input,
                output_path=models_dir,
                filter_on=["environment"],
            )
            create_conda_pack(
                src_input="{FLAGS.input}/environment",
                output_name=CONDA_TAR_NAME,
                output_dir=conda_tar_dir,
                builder_tag=BUILD_IMAGE_TAG,
            )
        else:
            src_copy(
                input_path="./src", output_path=models_dir, filter_on=["environment"]
            )
            create_conda_pack(
                src_input="./src/environment",
                output_name=CONDA_TAR_NAME,
                output_dir=conda_tar_dir,
                builder_tag=BUILD_IMAGE_TAG,
            )
            # create_conda_pack(CONDA_TAR_NAME, ".src/", conda_tar_dir, BUILD_IMAGE_TAG)

        if FLAGS.skip == "pack":
            sys.exit(0)

    if FLAGS.action == "download":
        dest_path = ARTIFACTS_PATH

        if FLAGS.output is not None:
            dest_path = FLAGS.output

        if FLAGS.hf_repo is not None:
            download_hf_artifacts(FLAGS.hf_repo, local_dir=dest_path, force=FLAGS.force)
            sys.exit(0)

        if FLAGS.spacy_model is not None:
            store_spacy_artifacts(FLAGS.spacy_model, dest_path, FLAGS.model_version)
            sys.exit(0)

        download_from_url(FLAGS.download, local_path=dest_path)

    if FLAGS.action == "clean":
        if FLAGS.conda_build_clean:
            delete_build_image(BUILD_IMAGE_TAG)
            sys.exit(0)

        log("Deleting build environment artifacts")
        delete_dir(DIST_PATH)
        delete_dir(".tmp")
        delete_build_image(BUILD_IMAGE_TAG)
        sys.exit(0)

    if FLAGS.action == "model":
        if FLAGS.list is not None:
            list_models()
            sys.exit(0)

        if FLAGS.load is not None:
            load_model(FLAGS.load)
            sys.exit(0)

        if FLAGS.unload is not None:
            load_model(FLAGS.unload)
            sys.exit(0)
