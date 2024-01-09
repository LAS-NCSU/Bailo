import numpy as np
import triton_python_backend_utils as pb_utils
import urllib
import traceback
from tqdm import tqdm
import json

class TritonPythonModel:
    """
    Your Python model must use the same class name. Every Python model
    that is created must have "TritonPythonModel" as the class name.
    """

    def initialize(self, args):
        """
        Called once the model is being loaded
        Implementing initialize is optional. Initialize allows you to do any necessary initializations before execution. 
        This can be used to load in models or other artifacts.

        This function initializes pre-trained model,
        depending on the value specified by an `instance_group` parameter
        in `config.pbtxt`.

        Depending on what `instance_group` was specified in
        the config.pbtxt file (KIND_CPU or KIND_GPU), the model instance
        will be initialised on a cpu, a gpu, or both. If `instance_group` was
        not specified in the config file, then models will be loaded onto
        the default device of the framework.

        Args:
            args (dict{string:string}): A python dict containing the following keys:
                * model_config: A JSON string containing the model configuration
                * model_instance_kind: A string containing model instance kind
                * model_instance_device_id: A string containing model instance device ID
                * model_repository: Model repository path
                * model_version: Model version
                * model_name: Model name
        """

        # Here we set up the device onto which our model will beloaded,
        # based on specified `model_instance_kind` and `model_instance_device_id`
        # fields.
        device = "cuda" if args["model_instance_kind"] == "GPU" else "cpu"
        device_id = args["model_instance_device_id"]
        self.device = f"{device}:{device_id}"

        # You must parse model_config. JSON string is not parsed here
        self.model_config = json.loads(args["model_config"])

        # Get OUTPUT0 configuration
        output0_config = pb_utils.get_output_config_by_name(self.model_config, "OUTPUT0")

        # Convert Triton types to numpy types
        self.output0_dtype = pb_utils.triton_string_to_numpy(output0_config["data_type"])

        # If attempting to load a model or processor from a local directory use:
        # model_path = os.path.join(f"{os.path.dirname(os.path.abspath(__file__))}", 'artifacts', model_name)
        # This returns an full path to where this file is running in triton and directs to 
        # the model folder.
        if device == "cuda":
            # Load model with gpu/cuda
            # self.model = 
            pass
        else:
            # Load model cpu
            # self.model = 
            pass

    # Triton way to define inferencing model, execute called during API call
    def execute(self, requests):
        """
        Execute function is called whenever an inference request is made. Every Python model must implement execute
        function. In the execute function you are given a list of InferenceRequest objects. 
        
        Default Mode:
        
        This is the most generic way you would like to implement your model and requires the execute function to return exactly one response per request.
        This entails that in this mode, your execute function must return a list of InferenceResponse objects that has the same length as requests.
        The work flow in this mode is:
            - execute function receives a batch of pb_utils.InferenceRequest as a length N array.
            - Perform inference on the pb_utils.InferenceRequest and append the corresponding pb_utils.InferenceResponse to a response list.
            - Return back the response list.
                - The length of response list being returned must be N.
                - Each element in the list should be the response for the corresponding element in the request array.
                - Each element must contain a response (a response can be either output tensors or an error); an element cannot be None.

        Triton checks to ensure that these requirements on response list are satisfied and if not returns an error response for all inference requests. 
        Upon return from the execute function all tensor data associated with the InferenceRequest objects passed to the function are deleted, 
        and so InferenceRequest objects should not be retained by the Python model.
        
        Args:
            requests ([pb_utils.InferenceRequest]): An array of length N number of inference requests.

        Returns:
            [pb_utils.InferenceResponse]: An array of length N number of inference responses where N = length([pb_utils.InferenceRequest]).
        """

        logger = pb_utils.Logger
        responses = []
        # Since Triton can batch you might have one or more requests come in at once. 
        for request in requests:
            # Parameters can be passed in the inference request.
            # request.parameters() returns a json string
            request_parameters = json.loads(request.parameters())

            # Here is an example of setting an extra parameter to flag the request as a certain type.
            payload_type = request_parameters.get("payload_type", None)
            logger.log_info(f"Payload type: {payload_type}")

            if payload_type == None:
                # If there is an error append an error response to the responses.
                responses.append(pb_utils.InferenceResponse(
                    error=pb_utils.TritonError("No payload_type set in request parameters.")))
                logger.log_error("No payload_type set in request parameters.")
                continue
        
            if payload_type not in ["image", "text"]:
                # If there is an error append an error response to the responses.
                responses.append(pb_utils.InferenceResponse(
                    error=pb_utils.TritonError(f"Request payload_type of {payload_type} must be set to 'image' or 'text'.")))
                logger.log_error(f"Request payload_type of {payload_type} must be set to 'image' or 'text'.")
                continue

            try:
                # Getting inputs from request and converting them into needed formats
                # Original Inputs from post request:
                # ["This is a string", "This is another string"]
                # 
                # After the payload_data is converted to a numpy array
                # [b"This is a string", b"This is another string"]
                # So we need to convert it back to a regular list of strings
                payload_data = pb_utils.get_input_tensor_by_name(request, "INPUT__0")
                payload_strings = [item.decode("utf-8") for item in payload_data.as_numpy().flatten().tolist()]
                
                #Handle image request
                if payload_type == "image":
                    out_tensor_0 = pb_utils.Tensor("OUTPUT__0", np.array(payload_strings).astype(self.output0_dtype))
                    response = pb_utils.InferenceResponse(output_tensors=[out_tensor_0])
                    responses.append(response)
                    continue
                
                # Some other path... perhaps we'd use a different processing method
                out_tensor_0 = pb_utils.Tensor("OUTPUT0", np.array(payload_strings).astype(self.output0_dtype))
                response = pb_utils.InferenceResponse(output_tensors=[out_tensor_0])
                responses.append(response)
                continue

            except Exception as error:
                responses.append(pb_utils.InferenceResponse(
                    error=pb_utils.TritonError(error)))
                continue

        return responses
    
    def finalize(self):
        """`finalize` is called only once when the model is being unloaded.
        Implementing `finalize` function is optional. This function allows
        the model to perform any necessary clean ups before exit.
        """
        print("Cleaning up...")
                
