from pydantic import BaseModel
from pathlib import Path
from enum import Enum
from typing import Optional

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
    langage:str = "fr"
    col_label:str|None = None # TODO: load existing tags
    cols_context:list = [] # TODO: select variable to keep

class Action(str, Enum):
    delete = "delete"
    add = "add"
    update = "update"

class Scheme(BaseModel):
    """
    Set of labels
    """
    labels:list[str]

class NextModel(BaseModel):
    """
    Request of an element
    """
    scheme:str = "default"
    mode:str = "deterministic"
    on:str|None = "untagged"

class SchemesModel(BaseModel):
    """
    Schemes model    
    """
    project_name:str
    availables:dict

class UserModel(BaseModel):
    name:str
    
class ElementModel(BaseModel):
    element_id:str
    text:Optional[str] = None
    selection: Optional[str] = None
    info: Optional[str] = None
    context: Optional[str] = None

class AnnotationModel(BaseModel):
    """
    Specific Annotatoin
    """
    project_name:str
    element_id:str
    tag:str
    user:str
    scheme:str = "current"

class SchemeModel(BaseModel):
    """
    Specific scheme
    """
    project_name:str
    name:str
    user:str
    tags:list = []

class RegexModel(BaseModel):
    """
    Regex
    """
    project_name:str
    name:str
    value:str

class Error(BaseModel):
    error:str

class SimpleModelModel(BaseModel):
    features:list
    model:str
    params:dict|None
    scheme:str
    user:str

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