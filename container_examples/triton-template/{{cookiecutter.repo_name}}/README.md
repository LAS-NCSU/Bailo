# {{cookiecutter.project_name}}

{{cookiecutter.description}}

## Project layout

```bash
{{cookiecutter.repo_name}}/
├── Makefile
├── README.md
├── utils.py
├── dev-requirements.txt
├── docker-compose-gpu.yml
├── docker-compose.yml
├── docs
├── k8s-seldon-deployments
│   ├── model_deployment
│   │   └── triton-{{cookiecutter.model_name}}-model.yaml
│   └── server_deployment
│       └── triton-with-gpu.yaml
├── metadata.yaml
├── notebooks
│   ├── README.md
│   └── triton_inference_examples.ipynb
└── src
    ├── environment
    │   ├── Dockerfile.build
    │   ├── base_environment.yml
    │   └── requirements.txt
    └── {{cookiecutter.model_name}}
        ├── 1
        │   ├── artifacts
        │   └── model.py
        └── config.pbtxt
```

## Setting up Build/Dev Environment

Requirements:

- Python 3.10

1. Create a `Python 3.10` virtual environment and install dev/build dependencies.

    ```bash
    make setup_env
    ```

2. Activate that environment.  

    ```bash
    source .virtenv/bin/activate
    ```

## Migrating inferece to Triton

Note: The directory structure in this project is the directory structure Triton expects to load.

1. Add python package requirements to [src/environment/requirements.txt](src/environment/requirements.txt). This should include any python packages needed to run your model for inference.
2. Update [src/{{cookiecutter.model_name}}/1/model.py](src/{{cookiecutter.model_name}}/1/model.py) template.  Details can be found in the pydoc strings in `model.py`
3. Update `input` and `output` in [src/{{cookiecutter.model_name}}/config.pbtxt](src/{{cookiecutter.model_name}}/config.pbtxt) to define the kinds of inputs and outputs the model can receive.

   - Ref: <https://docs.seldon.io/projects/seldon-core/en/latest/reference/apis/v2-protocol.html>
   - Ref: <https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_configuration.html>
  
4. Run `python utils.py -b` to create a distribution of files needed for deploying the model into NVidea Triton.

    After your `dist` folder should look something like:

    ```bash
        dist/
        ├── environment.yml
        └── {{cookiecutter.model_name}}
            ├── 1
            │   ├── artifacts
            │   └── model.py
            ├── config.pbtxt
            └── triton-custom-env.tar.gz
    ```

5. Download model artifacts/weights to the `dist/{{cookiecutter.model_name}}/1/artifacts`

## Testing in Triton

Start Triton for testing

The Triton container will mount `dist/{{cookiecutter.model_name}}` at start and load in `dist/{{cookiecutter.model_name}}/triton-custom-env.tar.gz`.  This will take a few moments.

CPU Mode:

```bash
docker-compose up -d
```

GPU Mode:

```bash
docker-compose -f docker-compose-gpu.yml up -d
```

## Logging/Debugging

- You can enable/disable verbose logging in triton by adding/removing the `--log-verbose=1` option to the triton service command.
- You can get verbose output from the `utils.py` using the `-v` option

## Cleanup

- `python utils.py --clean`
  - Deletes the `dist` directory and deletes the `conda_env_builder:latest` docker image.
- `python utils.py --conda-build-clean`
  - Removes the `conda_env_builder:latest` docker image used to create the conda-pack tar

## V2 API specification

<https://docs.seldon.io/projects/seldon-core/en/latest/reference/apis/v2-protocol.html>

### Important API endpoints

- Model inferencing: /v2/models/\<model name>/infer
- Model Metadata: /v2/models/\<model name>
- Server is live: /v2/health/live
- Server is ready: /v2/health/ready

## Finding your deployed container's endpoint

### Testing Examples

Near the end of the [triton_clip_test.ipynb](triton_clip_test.ipynb) notebook there are cells that demonstrate how to send, receive and use predictions to the model running on Triton

----
