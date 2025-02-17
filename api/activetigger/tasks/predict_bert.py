import gc
import json
import logging
import multiprocessing
import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
from pandas import DataFrame
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)

from activetigger.tasks.base_task import BaseTask


class PredictBert(BaseTask):
    """
    Class to predict with a bert model

    Parameters:
    ----------
    path (Path): path to save the files
    name (str): name of the model
    df (DataFrame): labelled data
    col_text (str): text column
    col_label (str): label column
    base_model (str): model to use
    params (dict) : training parameters
    test_size (dict): train/test distribution
    event : possibility to interrupt
    unique_id : unique id for the current task
    """

    kind = "predict_bert"

    def __init__(
        self,
        path: Path,
        df: DataFrame,
        col_text: str,
        col_label: str | None = None,
        batch: int = 32,
        file_name: str = "predict.parquet",
        event: Optional[multiprocessing.synchronize.Event] = None,
        unique_id: Optional[str] = None,
        **kwargs,
    ):
        super().__init__()
        self.path = path
        self.df = df
        self.col_text = col_text
        self.col_label = col_label
        self.event = event
        self.unique_id = unique_id
        self.file_name = file_name
        self.batch = batch

    def __call__(self) -> dict:
        """
        Main process to predict
        """
        # empty cache
        torch.cuda.empty_cache()

        # check if GPU available
        gpu = False
        if torch.cuda.is_available():
            print("GPU is available")
            gpu = True

        # logging the process
        log_path = self.path / "status_predict.log"
        progress_path = self.path / "progress_predict"
        logger = logging.getLogger("predict_bert_model")
        file_handler = logging.FileHandler(log_path)
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        print("load model")
        with open(self.path / "config.json", "r") as jsonfile:
            modeltype = json.load(jsonfile)["_name_or_path"]
        tokenizer = AutoTokenizer.from_pretrained(modeltype)
        model = AutoModelForSequenceClassification.from_pretrained(self.path)

        print("function prediction : start")
        if torch.cuda.is_available():
            model.cuda()

        try:
            # Start prediction with batches
            predictions = []
            # logging the process
            for chunk in [
                self.df[self.col_text][i : i + self.batch]
                for i in range(0, self.df.shape[0], self.batch)
            ]:
                # user interrupt
                if self.event.is_set():
                    logger.info("Event set, stopping training.")
                    raise Exception("Event set, stopping training.")

                print("Next chunck prediction")
                chunk = tokenizer(
                    list(chunk),
                    padding=True,
                    truncation=True,
                    max_length=512,
                    return_tensors="pt",
                )
                if gpu:
                    chunk = chunk.to("cuda")
                with torch.no_grad():
                    outputs = model(**chunk)
                res = outputs[0]
                if gpu:
                    res = res.cpu()
                res = res.softmax(1).detach().numpy()
                predictions.append(res)

                # write progress
                with open(progress_path, "w") as f:
                    f.write(
                        str((len(predictions) * self.batch / self.df.shape[0]) * 100)
                    )

            # to dataframe
            pred = pd.DataFrame(
                np.concatenate(predictions),
                columns=sorted(list(model.config.label2id.keys())),
                index=self.df.index,
            )

            # calculate entropy
            entropy = -1 * (pred * np.log(pred)).sum(axis=1)
            pred["entropy"] = entropy

            # calculate label
            pred["prediction"] = pred.drop(columns="entropy").idxmax(axis=1)

            # if asked, add the label column for latter statistics
            if self.col_label:
                pred[self.col_label] = self.df[self.col_label]

            # write the content in a parquet file
            pred.to_parquet(self.path / self.file_name)
            print("Written", self.file_name)
            return {
                "success": True,
                "path": str(self.path.joinpath(self.file_name)),
            }
        except Exception as e:
            print("Error in prediction", e)
            raise e
        finally:
            # delete the logs
            os.remove(log_path)
            os.remove(progress_path)
            # clean memory
            del tokenizer, model, chunk, self.df, res, predictions, outputs, self.event
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.synchronize()
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
