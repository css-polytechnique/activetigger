//import { omit } from 'lodash';
import { FC, useEffect, useState } from 'react';
import DataTable from 'react-data-table-component';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';

import { omit } from 'lodash';
import { unparse } from 'papaparse';
import { usePredictOnDataset } from '../../core/api';
import { useNotifications } from '../../core/notifications';
import { loadFile } from '../../core/utils';
import { TextDatasetModel } from '../../types';

// format of the data table
export interface DataType {
  headers: string[];
  data: Record<string, string | number | bigint>[];
  filename: string;
}

export interface ImportPredictionDatasetProps {
  projectSlug: string;
  scheme: string;
  modelName: string;
}

// component
export const ImportPredictionDataset: FC<ImportPredictionDatasetProps> = ({
  projectSlug,
  scheme,
  modelName,
}) => {
  const maxSizeMo = 50;
  const maxSize = maxSizeMo * 1024 * 1024; // 100 MB in bytes

  // form management
  const { register, control, handleSubmit, reset } = useForm<
    TextDatasetModel & { files: FileList }
  >({
    defaultValues: {},
  });
  const predict = usePredictOnDataset(); // API call
  const { notify } = useNotifications();

  const [data, setData] = useState<DataType | null>(null);
  const files = useWatch({ control, name: 'files' });
  // available columns
  const columns = data?.headers.map((h) => (
    <option key={h} value={h}>
      {h}
    </option>
  ));

  // convert paquet file in csv if needed when event on files
  useEffect(() => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > maxSize) {
        notify({
          type: 'error',
          message: `File is too big (only file less than ${maxSizeMo} are allowed)`,
        });
        return;
      }
      loadFile(file).then((data) => {
        if (data === null) {
          notify({ type: 'error', message: 'Error reading the file' });
          return;
        }
        setData(data);
      });
    }
  }, [files, maxSize, notify, setData]);
  // action when form validated
  const onSubmit: SubmitHandler<TextDatasetModel & { files: FileList }> = async (formData) => {
    if (data) {
      if (!formData.id || !formData.text) {
        notify({ type: 'error', message: 'Please fill all the fields' });
        return;
      }
      const csv = data ? unparse(data.data, { header: true, columns: data.headers }) : '';
      await predict(projectSlug, scheme, modelName, {
        ...omit(formData, 'files'),
        csv,
        filename: data.filename,
      });
      setData(null);
      reset();
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <form onSubmit={handleSubmit(onSubmit)} className="form-frame">
          <h4 className="subsection">Import external texts to predict</h4>
          <div className="explanations">
            One predicted, you can export them in Export as the external dataset. If you predict on
            a new dataset, it will erase the previous one.
          </div>
          <div>
            <label className="form-label" htmlFor="csvFile">
              Import text dataset to predict
            </label>
            <input className="form-control" id="csvFile" type="file" {...register('files')} />
            {
              // display datable if data available
              data !== null && (
                <div>
                  <div>Preview</div>
                  <div className="m-3">
                    Size of the dataset : <b>{data.data.length - 1}</b>
                  </div>
                  <DataTable<Record<DataType['headers'][number], string | number>>
                    columns={data.headers.map((h) => ({
                      name: h,
                      selector: (row) => row[h],
                      format: (row) => {
                        const v = row[h];
                        return typeof v === 'bigint' ? Number(v) : v;
                      },
                      width: '200px',
                    }))}
                    data={
                      data.data.slice(0, 5) as Record<keyof DataType['headers'], string | number>[]
                    }
                  />
                </div>
              )
            }
          </div>

          {
            // only display if data
            data != null && (
              <div>
                <div>
                  <label className="form-label" htmlFor="col_id">
                    Column for id (they need to be unique, otherwise replaced by a number)
                  </label>
                  <select
                    className="form-control"
                    id="col_id"
                    disabled={data === null}
                    {...register('id')}
                  >
                    {columns}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="col_text">
                    Column for text
                  </label>
                  <select
                    className="form-control"
                    id="col_text"
                    disabled={data === null}
                    {...register('text')}
                  >
                    <option key="none"></option>

                    {columns}
                  </select>
                </div>
                <button type="submit" className="btn btn-info my-4 form-button col-6">
                  Launch the prediction on the imported dataset
                </button>
              </div>
            )
          }
        </form>
      </div>
    </div>
  );
};
