from pydantic import BaseModel
from pathlib import Path
from enum import Enum
from typing import Optional, List, Dict, Any


class ProjectModel(BaseModel):
    """
    Parameters of a project
    """
    project_name:str
    user:str
    col_text:str
    col_id:str
    n_rows:int = 2000
    n_train:int
    n_test:int
    dir:Path|None = None
    embeddings:list = []
    n_skip:int = 0
    default_scheme: list = []
    language:str = "fr"
    col_label:str|None = None # TODO: load existing tags
    cols_context:list = []
    cols_test:list = []
    test: bool = False


class Action(str, Enum):
    delete = "delete"
    add = "add"
    update = "update"

class Scheme(BaseModel):
    """
    Set of labels
    """
    labels:list[str]

class NextInModel(BaseModel):
    scheme:str
    selection:str = "deterministic"
    sample:str = "untagged"
    tag:str|None = None
    frame:list[float]|None = None
    history: list = []

class ElementOutModel(BaseModel):
    element_id:str
    text:str
    context:Dict[str, Any]
    selection:str
    info:str
    predict:str
    frame:list
    limit:int

class SchemesModel(BaseModel):
    """
    Schemes model    
    """
    project_name:str
    availables:dict
    
class User(BaseModel):
    username: str
    status:str|None

class UserInDB(User):
    hashed_password: str

class UsersServer(BaseModel):
    users:list
    auth:list

class Token(BaseModel):
    access_token: str
    token_type: str
    status: str|None

class AnnotationModel(BaseModel):
    """
    Specific Annotatoin
    """
    project_name:str
    element_id:str
    tag:str
    user:str
    scheme:str
    selection: Optional[str] = None

class SchemeModel(BaseModel):
    """
    Specific scheme
    """
    project_name:str
    name:str
    tags: Optional[list] = []

class RegexModel(BaseModel):
    """
    Regex
    """
    project_name:str
    name:str
    value:str
    user:str

class Error(BaseModel):
    error:str

class Success(BaseModel):
    success:str

class Data(BaseModel):
    data:dict|str

class SimpleModelModel(BaseModel):
    features:list
    model:str
    params:dict|None
    scheme:str
#    user:str
    standardize: Optional[bool] = True

class BertModelModel(BaseModel):
    project_name:str
    user:str
    scheme:str
    name:str
    base_model:str
    params:dict
    test_size:float

class TableElementsModel(BaseModel):
    list_ids:list
    list_labels:list
    scheme:str
    action:str

class ProjectionInModel(BaseModel):
    method:str
    features:list
    params:dict

class ProjectionOutModel(BaseModel):
    status: str
    data: Dict[str, Any]

class ParamsModel(BaseModel):
    params:dict

# Validation JSON
#----------------

class LiblinearParams(BaseModel):
    cost:float

class KnnParams(BaseModel):
    n_neighbors:int

class RandomforestParams(BaseModel):
    n_estimators:int
    max_features:int|None

class LassoParams(BaseModel):
    C:int

class Multi_naivebayesParams(BaseModel):
    alpha:float
    fit_prior:bool
    class_prior:bool

class BertParams(BaseModel):
    batchsize: int
    gradacc: float
    epochs: int
    lrate: float
    wdecay: float
    best: bool
    eval: int
    gpu: bool
    adapt: bool

class UmapParams(BaseModel):
    n_neighbors: int
    min_dist: float
    n_components: int
    metric: str

class TsneParams(BaseModel):
    n_components: int
    learning_rate: str|float
    init: str
    perplexity: int

class ZeroShotModel(BaseModel):
    scheme:str
    prompt: str
    api: str
    token: str
    number: int = 10

class TableModel(BaseModel):
    columns: List[str]
    content: Dict[str, Any]

class ProjectsServer(BaseModel):
    projects:list
    auth:list

class StateModel(BaseModel):
    params: ProjectModel
    next: Dict[str, Any]
    schemes: Dict[str, Any]
    features: Dict[str, Any]
    simplemodel: Dict[str, Any]
    bertmodels: Dict[str, Any]
    projections: Dict[str, Any]
    zeroshot: Dict[str, Any]

class QueueModel(BaseModel):
    content: Dict[str, Dict[str, Any]]

class DescriptionProject(BaseModel):
    content: Dict[str, Any]

class ProjectAuths(BaseModel):
    auth: Dict[str, Any]

class WaitingModel(BaseModel):
    detail:str
    status:str = "waiting"