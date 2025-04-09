import { pick } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import PulseLoader from 'react-spinners/PulseLoader';

import { useGetElementById, useGetProjectionData, useUpdateProjection } from '../core/api';
import { useAuth } from '../core/auth';
import { useAppContext } from '../core/context';
import { useNotifications } from '../core/notifications';
import { ElementOutModel, ProjectionInStrictModel, ProjectionModelParams } from '../types';
import { ProjectionVizSigma } from './ProjectionVizSigma';
import { MarqueBoundingBox } from './ProjectionVizSigma/MarqueeController';

import chroma from 'chroma-js';

interface ProjectionManagementProps {
  projectName: string | null;
  projectSlug?: string;
  currentScheme: string | null;
  availableFeatures: string[];
}

// define the component
export const ProjectionManagement: FC<ProjectionManagementProps> = ({
  projectName,
  currentScheme,
  availableFeatures,
}) => {
  // hook for all the parameters
  const {
    appContext: { currentProject: project, currentProjection, selectionConfig },
    setAppContext,
  } = useAppContext();
  const navigate = useNavigate();
  const { notify } = useNotifications();

  const { authenticatedUser } = useAuth();
  const { getElementById } = useGetElementById(projectName || null, currentScheme || null);

  // fetch projection data with the API (null if no model)
  const { projectionData, reFetchProjectionData } = useGetProjectionData(
    projectName,
    currentScheme,
  );

  // unique labels
  const uniqueLabels = projectionData ? [...new Set(projectionData.labels)] : [];
  const colormap = chroma.scale('Paired').colors(uniqueLabels.length);

  // form management
  const availableProjections = useMemo(() => project?.projections, [project?.projections]);

  const { register, handleSubmit, watch, control, reset } = useForm<ProjectionInStrictModel>({
    defaultValues: {
      method: 'umap',
      params: {
        //common
        n_components: 2,
        // T-SNE
        perplexity: 30,
        learning_rate: 'auto',
        init: 'random',
        // UMAP
        metric: 'cosine',
        n_neighbors: 15,
        min_dist: 0.1,
      },
    },
  });
  const selectedMethod = watch('method'); // state for the model selected to modify parameters

  // available features
  const features = availableFeatures.map((e) => ({ value: e, label: e }));

  // action when form validated
  const { updateProjection } = useUpdateProjection(projectName, currentScheme);
  const onSubmit: SubmitHandler<ProjectionInStrictModel> = async (formData) => {
    // fromData has all fields whatever the selected method

    // discard unrelevant fields depending on selected method
    const relevantParams =
      selectedMethod === 'tsne'
        ? ['perplexity', 'n_components', 'learning_rate', 'init']
        : selectedMethod === 'umap'
          ? ['n_neighbors', 'min_dist', 'metric', 'n_components']
          : [];
    const params = pick(formData.params, relevantParams) as ProjectionModelParams;
    const data = { ...formData, params };
    const watchedFeatures = watch('features');
    console.log('watchedFeatures', watchedFeatures);
    if (watchedFeatures.length == 0) {
      notify({ type: 'error', message: 'Please select at least one feature' });
      return;
    }
    await updateProjection(data);
    setFormNewProjection(false);
    reset();
  };

  // scatterplot management for colors
  const [labelColorMapping, setLabelColorMapping] = useState<{ [key: string]: string } | null>(
    null,
  );

  useEffect(() => {
    if (projectionData) {
      const labeledColors = uniqueLabels.reduce<Record<string, string>>(
        (acc, label, index: number) => {
          acc[label as string] = colormap[index];
          return acc;
        },
        {},
      );
      setLabelColorMapping(labeledColors);
    }
  }, [projectionData]);

  // manage projection refresh (could be AMELIORATED)
  useEffect(() => {
    // case a first projection is added
    if (
      authenticatedUser &&
      !currentProjection &&
      availableProjections?.available[authenticatedUser?.username]
    ) {
      reFetchProjectionData();
      setAppContext((prev) => ({ ...prev, currentProjection: projectionData?.status }));
      console.log('Fetch projection data');
    }
    // case if the projection changed
    if (
      authenticatedUser &&
      currentProjection &&
      currentProjection != availableProjections?.available[authenticatedUser?.username]
    ) {
      console.log('Refetch projection data');
      reFetchProjectionData();
      setAppContext((prev) => ({ ...prev, currentProjection: projectionData?.status }));
    }
  }, [
    availableProjections?.available,
    authenticatedUser,
    currentProjection,
    reFetchProjectionData,
    projectionData,
    setAppContext,
  ]);

  // element to display
  const [selectedElement, setSelectedElement] = useState<ElementOutModel | null>(null);
  const setSelectedId = useCallback(
    (id?: string) => {
      if (id)
        getElementById(id, 'train').then((element) => {
          setSelectedElement(element || null);
        });
      else setSelectedElement(null);
    },
    [getElementById, setSelectedElement],
  );

  // transform frame type to bbox type
  const frameAsBbox: MarqueBoundingBox | undefined = useMemo(
    () =>
      selectionConfig.frame
        ? {
            x: { min: selectionConfig.frame[0], max: selectionConfig.frame[1] },
            y: { min: selectionConfig.frame[2], max: selectionConfig.frame[3] },
          }
        : undefined,
    [selectionConfig.frame],
  );

  const projectionTraining =
    authenticatedUser && project
      ? authenticatedUser?.username in project.projections.training
      : false;

  const [formNewProjection, setFormNewProjection] = useState<boolean>(false);

  type Feature = {
    label: string;
    value: string;
  };
  const filterFeatures = (features: Feature[]) => {
    const filtered = features.filter((e) => /sbert|fasttext/i.test(e.label));
    return filtered;
  };
  const defaultFeatures = filterFeatures(features);
  console.log(defaultFeatures);

  return (
    <div>
      {!projectionTraining && (
        <button
          className="btn btn-primary btn-validation mb-3"
          onClick={() => setFormNewProjection(!formNewProjection)}
        >
          Compute new projection
        </button>
      )}

      {projectionTraining && (
        <div className="col-8 d-flex justify-content-center">
          <div className="d-flex align-items-center gap-2">
            <PulseLoader /> Computing a projection, please wait
          </div>
        </div>
      )}

      {!projectionTraining && formNewProjection && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 col-8">
          <h4 className="subsection">Compute new projection</h4>
          <label htmlFor="model">Select a model</label>
          <select id="model" {...register('method')}>
            <option value=""></option>
            {Object.keys(availableProjections?.options || {}).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}{' '}
          </select>
          <div>
            <label htmlFor="features">Select features</label>
            <Controller
              name="features"
              control={control}
              defaultValue={defaultFeatures.map((e) => e.value)}
              render={({ field: { onChange, value } }) => (
                <Select
                  options={features}
                  isMulti
                  value={features.filter((option) => value.includes(option.value))}
                  onChange={(selectedOptions) => {
                    onChange(selectedOptions ? selectedOptions.map((option) => option.value) : []);
                  }}
                />
              )}
            />
          </div>
          {availableProjections?.options && selectedMethod == 'tsne' && (
            <div>
              <label htmlFor="perplexity">perplexity</label>
              <input
                type="number"
                step="1"
                id="perplexity"
                {...register('params.perplexity', { valueAsNumber: true })}
              ></input>
              <label>Learning rate</label>
              <select {...register('params.learning_rate')}>
                <option key="auto" value="auto">
                  auto
                </option>
              </select>
              <label>Init</label>
              <select {...register('params.init')}>
                <option key="random" value="random">
                  random
                </option>
              </select>
            </div>
          )}
          {availableProjections?.options && selectedMethod == 'umap' && (
            <div>
              <label htmlFor="n_neighbors">n_neighbors</label>
              <input
                type="number"
                step="1"
                id="n_neighbors"
                {...register('params.n_neighbors', { valueAsNumber: true })}
              ></input>
              <label htmlFor="min_dist">min_dist</label>
              <input
                type="number"
                id="min_dist"
                step="0.01"
                {...register('params.min_dist', { valueAsNumber: true })}
              ></input>
              <label htmlFor="metric">Metric</label>
              <select {...register('params.metric')}>
                <option key="cosine" value="cosine">
                  cosine
                </option>
                <option key="euclidean" value="euclidean">
                  euclidean
                </option>
              </select>
            </div>
          )}
          <label htmlFor="n_components">n_components</label>
          <input
            type="number"
            id="n_components"
            step="1"
            {...register('params.n_components', { valueAsNumber: true, required: true })}
          ></input>

          <button className="btn btn-primary btn-validation">Compute</button>
        </form>
      )}

      {projectionData && labelColorMapping && (
        <div>
          <details>
            <summary>parameters</summary>
            {JSON.stringify(projectionData?.parameters, null, 2)}
          </details>
          <div className="row align-items-start m-0" style={{ height: '500px' }}>
            <ProjectionVizSigma
              //className={`${selectedElement ? 'col-8' : 'col-12'} border p-0 h-100`}
              className={`col-8 border p-0 h-100`}
              data={projectionData}
              //selection
              selectedId={selectedElement?.element_id}
              setSelectedId={setSelectedId}
              frameBbox={frameAsBbox}
              setFrameBbox={(bbox?: MarqueBoundingBox) => {
                setAppContext((prev) => ({
                  ...prev,
                  selectionConfig: {
                    ...selectionConfig,
                    frame: bbox ? [bbox.x.min, bbox.x.max, bbox.y.min, bbox.y.max] : undefined,
                  },
                }));
              }}
              labelColorMapping={labelColorMapping}
            />
            <div className="col-4 overflow-y-auto h-100">
              {selectedElement ? (
                <div>
                  Element:{' '}
                  <div className="badge bg-light text-dark">{selectedElement.element_id}</div>
                  <div className="mt-2">{selectedElement.text}</div>
                  <div className="mt-2">
                    Previous annotations : {JSON.stringify(selectedElement.history)}
                  </div>
                  <button
                    className="btn btn-primary mt-3"
                    onClick={() =>
                      navigate(`/projects/${projectName}/annotate/${selectedElement.element_id}`)
                    }
                  >
                    Annotate
                  </button>
                </div>
              ) : (
                <div>Click on an element to display its content</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
