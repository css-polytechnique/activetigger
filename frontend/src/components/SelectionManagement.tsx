import { ChangeEvent, FC, useEffect, useState } from 'react';
import { FcStatistics } from 'react-icons/fc';
import { useGetSimpleModel } from '../core/api';
import { useAuth } from '../core/auth';
import { useAppContext } from '../core/context';
import { DisplayScores } from './DisplayScores';

// define the component to configure selection mode
export const SelectionManagement: FC = () => {
  const { authenticatedUser } = useAuth();
  const {
    appContext: { currentScheme, selectionConfig, currentProject: project, phase },
    setAppContext,
  } = useAppContext();

  const availableModes =
    authenticatedUser &&
    currentScheme &&
    project?.simplemodel.available[authenticatedUser.username]?.[currentScheme]
      ? project.next.methods
      : project?.next.methods_min
        ? project?.next.methods_min
        : [];

  const availableSamples = project?.next.sample ? project?.next.sample : [];

  // API call to get the current model & refetch
  const { currentModel } = useGetSimpleModel(
    project ? project.params.project_slug : null,
    currentScheme || null,
    project,
  );

  const [availableLabels, setAvailableLabels] = useState<string[]>(
    currentScheme && project ? project.schemes.available[currentScheme]['labels'] : [],
  );

  // update if new model
  useEffect(() => {
    // case where the simple model is dichotomize on a specific label
    if (currentModel && currentModel.params && currentModel.params['dichotomize']) {
      setAvailableLabels([
        currentModel.params['dichotomize'] as string,
        'not-' + currentModel.params['dichotomize'],
      ]);
    }
  }, [currentModel]);

  // force a default label
  useEffect(() => {
    if (!selectionConfig.label && availableLabels && availableLabels.length > 0) {
      setAppContext((prev) => ({
        ...prev,
        selectionConfig: { ...selectionConfig, label: availableLabels[0] },
      }));
    }
  }, [availableLabels, selectionConfig, setAppContext]);

  return phase == 'test' ? (
    <div>Test mode activated - deactivate first before annotating train set</div>
  ) : (
    <div className="w-100">
      <div className="d-flex align-items-center">
        <div className="mx-2 w-25">
          <label>Selection</label>
          <select
            className="form-select"
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setAppContext((prev) => ({
                ...prev,
                selectionConfig: { ...selectionConfig, mode: e.target.value },
              }));
            }}
            value={selectionConfig.mode}
          >
            {availableModes.map((e, i) => (
              <option key={i}>{e}</option>
            ))}
          </select>
        </div>
        {
          // label selection for maxprob OR when sample is tagged
          (selectionConfig.mode == 'maxprob' || selectionConfig.sample == 'tagged') && (
            <div className="mx-2 w-25">
              <label>Label</label>
              <select
                onChange={(e) => {
                  setAppContext((prev) => ({
                    ...prev,
                    selectionConfig: { ...selectionConfig, label: e.target.value },
                  }));
                }}
                className="form-select"
                value={selectionConfig.label}
              >
                {selectionConfig.sample == 'tagged' && <option key="">All</option>}
                {availableLabels.map((e, i) => (
                  <option key={i}>{e}</option>
                ))}{' '}
              </select>
            </div>
          )
        }
        <div className="mx-2 w-25">
          <label>On</label>
          <select
            className="form-select"
            onChange={(e) => {
              setAppContext((prev) => ({
                ...prev,
                selectionConfig: { ...selectionConfig, sample: e.target.value },
              }));
            }}
            value={selectionConfig.sample}
          >
            {availableSamples.map((e, i) => (
              <option key={i}>{e}</option>
            ))}{' '}
          </select>
        </div>
        {
          // input validated on deselect
        }
        <div className="w-50">
          <label htmlFor="select_regex">Filter</label>
          <input
            className="form-control"
            type="text"
            id="select_regex"
            placeholder="Search / Regex / CONTEXT= / QUERY="
            value={selectionConfig.filter}
            onChange={(e) => {
              setAppContext((prev) => ({
                ...prev,
                selectionConfig: { ...selectionConfig, filter: e.target.value },
              }));
            }}
          />
        </div>
      </div>
      <div className="d-flex align-items-top">
        <details className="mx-2">
          <summary className="explanations">
            Active model <FcStatistics />{' '}
            <span className="badge bg-light text-dark">
              {currentModel ? currentModel['model'] : 'No model trained'}
            </span>
          </summary>
          {currentModel && (
            <div>
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>Model parameters</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {currentModel.params &&
                    (currentModel.params && Object.entries(currentModel.params)).map(
                      ([key, value], i) => (
                        <tr key={i}>
                          <td>{key}</td>
                          <td>{value}</td>
                        </tr>
                      ),
                    )}
                </tbody>
                {/* <thead>
                  <tr>
                    <th>Indicators</th>
                    <th>Exact</th>
                    <th>CV10</th>
                  </tr>
                </thead>
                <tbody>
                  {currentModel.params &&
                    (currentModel.statistics && Object.entries(currentModel.statistics))
                      .filter(([key]) => key !== 'false_predictions')
                      .map(([key, value], i) => (
                        <tr key={i}>
                          <td>{key}</td>
                          <td> {JSON.stringify(value)}</td>
                          <td>
                            {' '}
                            {JSON.stringify(
                              (
                                currentModel.statistics_cv10 as Record<
                                  string,
                                  string | Record<string, number>
                                >
                              )[key],
                            )}
                          </td>
                        </tr>
                      ))}
                </tbody> */}
              </table>
              <div>
                <h5>Statistics</h5>
                <DisplayScores
                  scores={currentModel.statistics as unknown as Record<string, number>}
                  scores_cv10={currentModel.statistics_cv10 as unknown as Record<string, number>}
                />
              </div>
            </div>
          )}
        </details>
        <details className="mx-2">
          <summary className="explanations">Advanced options</summary>
          <label className="mx-4" style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={selectionConfig.frameSelection}
              className="mx-2"
              onChange={(_) => {
                setAppContext((prev) => ({
                  ...prev,
                  selectionConfig: {
                    ...selectionConfig,
                    frameSelection: !selectionConfig.frameSelection,
                  },
                }));
              }}
            />
            Use visualisation frame to lock the selection
          </label>
        </details>
      </div>
    </div>
  );
};
