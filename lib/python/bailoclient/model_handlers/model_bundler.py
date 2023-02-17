import tempfile
import subprocess
import os
from pathlib import Path
from glob import glob
from zipfile import ZipFile
from typing import List
from shutil import copyfile

from ..utils.enums import ModelFlavour
from bailoclient.utils.exceptions import (
    ModelFlavourNotFound,
    ModelTemplateNotAvailable,
    DirectoryNotFound,
    MissingFilesError,
    ModelMethodNotAvailable,
)


class Bundler:
    """Class for handling model bundling"""

    bundler_functions = {}
    model_py_templates = {}

    def bundle_model(
        self,
        output_path: str,
        model=None,
        model_binary: str = None,
        model_py: str = None,
        model_requirements: str = None,
        requirements_files_path: str = None,
        model_flavour: str = None,
        additional_files: List[str] = None,
    ):
        """Bundle model files into the required structure for the code.zip and binary.zip
            for uploading to BAILO.

            To save and bundle a model object, provide the model object and the model_flavour.
            Model bundling will be done using Mlflow, which you will need to have installed
            in your environment.

            To bundle a pre-saved model, you will need to provide the model_binary as a minimum.
            If you are not providing model_code you will need to provide a model_flavour so that
            the appropriate model template can be bundled with your model.

        Args:
            output_path (str): Output path for code and binary zips
            model (any, optional): Model object to save via Mlflow. Must be one of
                                    the formats supported by Mlflow.
                                    See https://www.mlflow.org/docs/latest/models.html#built-in-model-flavors
                                    Defaults to None.
            model_binary (str, optional): Path to model binary. Can be a file or directory. Defaults to None.
            model_py (str, optional): Path to model.py file. If not provided, you must provide
                                        a model flavour. Defaults to None.
            model_requirements (str, optional): Path to requirements.txt file OR path to a Python file,
                                                module or notebook from which to generate the
                                                requirements.txt. Defaults to None.
            model_flavour (str, optional): Name of the flavour of model. Supported flavours are
                                            those provided by MLflow. Defaults to None.
            additional_files (list[str], optional): List or tuple of file paths of additional dependencies
                                                    or directories of dependencies for the model.
                                                    Defaults to None.
        """

        if not os.path.exists(output_path):
            Path(output_path).mkdir(parents=True)

        if additional_files and not isinstance(additional_files, (tuple, list)):
            raise TypeError("Expected additional_files to be a list of file paths")

        if model_flavour:
            model_flavour = model_flavour.lower()

        if model:
            return self._save_and_bundle_model_files(
                model,
                output_path,
                model_flavour,
                additional_files,
                model_requirements,
                requirements_files_path,
                model_py,
            )

        return self._bundle_model_files(
            output_path,
            model_binary,
            model_py,
            model_requirements,
            requirements_files_path,
            model_flavour,
            additional_files,
        )

    def _bundle_model_files(
        self,
        output_path: str,
        model_binary: str,
        model_py: str,
        model_requirements: str,
        requirements_files_path: str,
        model_flavour: str,
        additional_files: List[str],
    ):
        if not model_binary:
            raise MissingFilesError(
                "Must provide model binary or model object and flavour"
            )

        if not model_requirements:
            raise MissingFilesError(
                "Provide either path to requirements.txt or your python file/notebook/module to generate requirements.txt"
            )

        if not model_py and model_flavour not in ModelFlavour:
            raise ModelFlavourNotFound(
                "A valid model flavour must be provided to generate the model.py file"
            )

        if not model_py:
            model_py = self._get_model_template(model_flavour)

        return self._transfer_and_bundle_model_files(
            model_code=model_py,
            model_requirements=model_requirements,
            requirements_files_path=requirements_files_path,
            additional_files=additional_files,
            model_binary=model_binary,
            output_path=output_path,
        )

    def _save_and_bundle_model_files(
        self,
        model,
        output_path: str,
        model_flavour: str,
        additional_files: List[str] = None,
        model_requirements: str = None,
        requirements_files_path: str = None,
        model_py: str = None,
    ):
        """Bundle model files via MLflow. Accepts models in 'flavors' that are supported
            by MLflow.

        Args:
            model (any): Model object in a format supported by MLflow
            output_path (str): Output path to save model files to
            model_flavour (str): Model flavour. Must be supported by MLflow
            additional_files (List[str], optional): List of additional files to include as
                                                    dependencies. Defaults to None.
            model_requirements (str, optional): Model requirements.txt file. Will be generated
                                                by MLflow if not provided. Defaults to None.
            model_py (str, optional): Path to model.py file. Will use the template for the
                                        model flavour if not provided. Defaults to None.

        Raises:
            TemplateNotAvailable: MLeap models do not have an available template
            ModelFlavourNotRecognised: The provided model flavour was not recognised
        """

        if model_flavour not in ModelFlavour:
            raise ModelFlavourNotFound("Invalid model flavour")

        if not model_py:
            model_py = self._get_model_template(model_flavour)

        tmpdir = tempfile.TemporaryDirectory()

        model_binary, optional_files = self._bundle_model(
            model, tmpdir.name, model_flavour, additional_files
        )

        self._transfer_and_bundle_model_files(
            model_code=model_py,
            model_requirements=model_requirements,
            requirements_files_path=requirements_files_path,
            additional_files=additional_files,
            model_binary=model_binary,
            output_path=output_path,
            optional_files=optional_files,
        )

        tmpdir.cleanup()

    def _get_model_template(self, model_flavour: str):
        """Get the model.py template file by model flavour

        Args:
            model_flavour (str): Model flavour

        Raises:
            ModelTemplateNotAvailable: No model template available for model_flavour

        Returns:
            str: file path to model.py template file for the model flavour
        """
        try:
            return self.model_py_templates[model_flavour]

        except:
            raise ModelTemplateNotAvailable(
                f"There is no model template available for {model_flavour}"
            )

    def _bundle_model(
        self,
        model,
        output_path: str,
        model_flavour: str,
        additional_files: List[str] = None,
    ):
        """Save model via model bundler

        Args:
            model (Model object): The model object to save
            output_path (str): Path to save the model to (should be a temp location)
            model_flavour (str): Model flavour to identify corresponding bundler
            additional_files (List[str], optional): Additional files required with the model.
                                                    Defaults to None.

        Raises:
            ModelMethodNotAvailable: There is no bundler function associated with the given
                                        model flavour

        Returns:
            Tuple(str, List[str]): Saved model filepath, list of any additional filepaths
        """
        try:
            bundler_function = self.bundler_functions[model_flavour]

        except KeyError:
            raise ModelMethodNotAvailable(
                f"Bundler function does not exist for {model_flavour}"
            ) from None

        model_code, optional_files = bundler_function(
            model=model,
            output_path=output_path,
            code_paths=additional_files,
        )

        return os.path.normpath(model_code), [
            os.path.normpath(file) for file in optional_files
        ]

    def _transfer_and_bundle_model_files(
        self,
        model_code: str,
        model_requirements: str,
        requirements_files_path: str,
        additional_files: str,
        model_binary: str,
        output_path: str,
        optional_files: str = None,
    ):
        """Create code.zip and binary.zip of provoded model files at output path.
            Copies all files to a tempdir in the format expected by BAILO.

        Args:
            model_code (str): Path to model.py file
            model_requirements (str): Path of requirements.txt file
            additional_files (List[str]): List of paths of any additional required files
            optional_files (List[str]): List of optional files which have been output from
                                        automatic model bundling (e.g. MLflow file, conda requirements)
            model_binary (str): Path of model binary
            output_path (str): Path to create the code.zip and binary.zip files
        """

        with tempfile.TemporaryDirectory() as tmpdir_name:
            code_path = os.path.join(tmpdir_name, "model", "code")
            Path(code_path).mkdir(parents=True)

            self._copy_model_py(model_code, code_path)

            self._copy_or_generate_requirements(
                model_requirements, requirements_files_path, model_code, code_path
            )

            if optional_files:
                self._copy_optional_files(optional_files, code_path)

            if additional_files:
                self._copy_additional_files(
                    additional_files, model_binary, tempfile.gettempdir(), code_path
                )

            # create zips
            self.zip_files(model_binary, os.path.join(output_path, "binary.zip"))
            self.zip_files(code_path, os.path.join(output_path, "code.zip"))

    def _copy_model_py(self, model_code: str, code_path: str):
        """Copy model.py file over to the code folder

        Args:
            model_code (str): Path to model.py code file
            code_path (str): Path to code folder
        """
        copyfile(model_code, os.path.join(code_path, "model.py"))

    def _copy_or_generate_requirements(
        self, model_requirements, requirements_files_path, model_code, output_path
    ):
        """If model_requirements is provided, copy the file to the output code_path.
        Otherwise, if requirements_files_path is given, generate the requirements from
        this file. If no paths are provided, use the model.py file to generate requirements

        Args:
            model_requirements (str): Path to requirements.txt
            requirements_files_path (str): Path to files from which to generate requirements.txt
            model_code (str): Path to model.py file
            output_path (str): Output path for model files
        """
        if model_requirements:
            copyfile(model_requirements, os.path.join(output_path, "requirements.txt"))

        elif requirements_files_path:
            self.generate_requirements_file(
                requirements_files_path, os.path.join(output_path, "requirements.txt")
            )

        else:
            self.generate_requirements_file(
                model_code, os.path.join(output_path, "requirements.txt")
            )

    def _copy_optional_files(self, optional_files: List[str], output_path: str):
        """Copy optional files from bundler module output. These filepaths are
        expected to be in the format tmp/tmpxyz/actual/path as they will be created
        into a temp folder when the bundler is run. This is used to get the
        assumed relative path in the new directory.

        Args:
            optional_files (List[str]): List of optional files to copy
            output_path (str): Output path for model files
        """
        for file_path in optional_files:
            # remove /tmp/tmpxyz/ from path
            relative_filepath = Path(*Path(file_path).parts[3:])

            os.makedirs(
                os.path.dirname(os.path.join(output_path, relative_filepath)),
                exist_ok=True,
            )

            copyfile(file_path, os.path.join(output_path, relative_filepath))

    def _copy_additional_files(
        self,
        additional_files: List[str],
        model_binary: str,
        temp_dir: str,
        output_path: str,
    ):
        """Copy additional files based on their location. Finds commonpath between
        tmpdir and model binary to establish whether additional files are local
        or in a temp directory

        Args:
            additional_files (List[str]): List of additional file paths
            model_binary (str): Model binary file path
            temp_dir (str): Temp directory file path
            output_path (str): Output path for model code files
        """
        if os.path.commonpath([model_binary, temp_dir]) == temp_dir:
            self.__copy_additional_files_from_tempdir(
                additional_files, os.path.join(output_path, "additional_files")
            )

        else:
            self.__copy_additional_files_from_local(
                additional_files,
                output_path,
                os.path.dirname(os.path.normpath(model_binary)),
            )

    def __copy_additional_files_from_tempdir(
        self, additional_files: List[str], output_path: str
    ):
        """Copy additional files from temp directory to output path. Creates output directory
        for additional files in the output path.

        Args:
            additional_files (List[str]): List of additional file paths
            output_path (str): Output path for model files
        """
        Path(output_path).mkdir(parents=True)

        for file_path in additional_files:
            copyfile(file_path, os.path.join(output_path, os.path.basename(file_path)))

    def __copy_additional_files_from_local(
        self, additional_files: List[str], output_path: str, model_parent_path: str
    ):
        """Copy additional files from the local file system to the output path. Creates
        output directories in the output location to match the file structure of the additional
        files relative to the parent directory

        Args:
            additional_files (List[str]): List of additional file paths
            output_path (str): Output path for model files
            model_parent_path (str): Parent path of the additional files to be
                            stripped from the additional files path when copied
        """

        for file_path in additional_files:
            output_file_path = os.path.join(
                output_path, os.path.relpath(file_path, model_parent_path)
            )
            os.makedirs(os.path.dirname(output_file_path), exist_ok=True)

            copyfile(
                file_path,
                output_file_path,
            )

    def zip_files(self, file_path: str, zip_path: str):
        """Create zip file at the specified zip path from a file or folder path

        Args:
            file_path (str): The file or folder to zip
            zip_path (str): Path to create the new zip at
        """
        if os.path.isdir(file_path):
            self.__zip_directory(file_path, zip_path)

        else:
            self.__zip_file(file_path, zip_path)

    def __zip_file(self, file_path: str, zip_path: str):
        """Zip a single file into new zip created at zip_path

        Args:
            file_path (str): Path to file to zip
            zip_path (str): Output path for zip
        """
        file_name = os.path.basename(file_path)

        with ZipFile(zip_path, "w") as zf:
            zf.write(file_path, arcname=file_name)

    def __zip_directory(self, dir_path: str, zip_path: str):
        """Zip a directory of files into new zip created at the zip_path

        Args:
            dir_path (str): Path to code or binary folder
            zip_path (str): Output path for zip
        """
        with ZipFile(zip_path, "w") as zf:
            for sub_file_path, _, files in os.walk(dir_path):
                output_dir = self.__get_output_dir(dir_path, sub_file_path)

                for file in files:
                    zf.write(
                        filename=os.path.join(sub_file_path, file),
                        arcname=os.path.join(output_dir, file),
                    )

    def __get_output_dir(self, dir_path: str, sub_dir_path: str):
        """Remove top level folder to get the output dir required for the zip files

        Args:
            dir_path (str): Path to code or binary directory
            sub_dir_path (str): Directory path within dir_path (i.e. within code or binary folder)

        Returns:
            str: Output directory with top level folder removed
        """
        if dir_path == sub_dir_path:
            return ""

        return os.path.join(Path(sub_dir_path).relative_to(dir_path)) + os.path.sep

    def generate_requirements_file(self, module_path: str, output_path: str):
        """Generate requirements.txt file based on imports within a Notebook,
            Python file, or Python project

        Args:
            module_path (str): Path to the Python file used to generate requirements.txt
            output_path (str): Output path in format output/path/requirements.txt

        Raises:
            Exception: Unable to create requirements.txt from specified file at specified location
        """
        try:
            subprocess.run(
                ["pipreqsnb", module_path, "--savepath", output_path],
                stderr=subprocess.STDOUT,
            )

        except subprocess.CalledProcessError:
            raise subprocess.CalledProcessError(
                "Unable to create requirements file at the specified location"
            ) from None
