import os
from pathlib import Path

import fasttext  # type: ignore[import]
import pandas as pd
from fasttext.util import download_model  # type: ignore[import]
from pandas import DataFrame, Series

from activetigger.functions import tokenize
from activetigger.tasks.base_task import BaseTask


class ComputeFasttext(BaseTask):
    """
    Compute sbert feature
    TODO : check of possible to avoid loop ?
    """

    kind = "compute_feature_sbert"

    def __init__(
        self,
        texts: Series,
        language: str,
        path_process: Path,
        path_models: Path,
        model: str = "",
    ):
        super().__init__()
        self.texts = texts
        self.path_process = path_process
        self.path_models = path_models
        self.language = language
        self.model = model

    def __call__(self) -> DataFrame:
        """
        Compute fasttext embedding
        Download the model if needed
        Args:
            texts (pandas.Series): texts
            model (str): model to use
        Returns:
            pandas.DataFrame: embeddings
        """
        if not self.path_models.exists():
            raise Exception(f"path {str(self.path_models)} does not exist")

        os.chdir(self.path_models)

        # if no model is specified, try to dl the language model
        if self.model is None or self.model == "":
            print(
                "If the model doesn't exist, it will be downloaded first. It could talke some time."
            )
            model_name = download_model(self.language, if_exists="ignore")
        else:
            model_name = self.model
            if not Path(model_name).exists():
                raise FileNotFoundError(f"Model {model_name} not found")
        texts_tk = tokenize(self.texts)
        ft = fasttext.load_model(model_name)
        emb = []
        for t in texts_tk:
            emb.append(ft.get_sentence_vector(t.replace("\n", " ")))
            # manage progress
            if len(emb) % 100 == 0:
                progress_percent = len(emb) / len(texts_tk) * 100
                with open(self.path_process.joinpath(self.unique_id), "w") as f:
                    f.write(str(round(progress_percent, 1)))
                print(progress_percent)

        # emb = [ft.get_sentence_vector(t.replace("\n", " ")) for t in texts_tk]
        df = pd.DataFrame(emb, index=self.texts.index)
        # WARN: this seems strange. Maybe replace with a more explicit syntax
        df.columns = ["ft%03d" % (x + 1) for x in range(len(df.columns))]  # type: ignore[assignment]
        return df
