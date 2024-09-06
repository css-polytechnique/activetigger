import { saveAs } from 'file-saver';
import { toPairs, values } from 'lodash';
import createClient, { Middleware } from 'openapi-fetch';
import { useCallback, useState } from 'react';
import type { paths } from '../generated/openapi';
import {
  AnnotationModel,
  AvailableProjectsModel,
  LoginParams,
  ProjectDataModel,
  ProjectStateModel,
  ProjectionInStrictModel,
  SimpleModelModel,
  TestSetDataModel,
  newBertModel,
} from '../types';
import { HttpError } from './HTTPError';
import { getAuthHeaders } from './auth';
import config from './config';
import { useNotifications } from './notifications';
import { getAsyncMemoData, useAsyncMemo } from './useAsyncMemo';

/**
 * API methods
 */

// all API calls are handled by a client generated by the openapi-fetch library
// It uses the `paths` types generated from the API openApi specifications by running `npm run generate`
export const api = createClient<paths>({ baseUrl: `${config.api.url}` });

// This authMiddleware injects the auth headers for each API call
const authMiddleware: Middleware = {
  // on each request the middleware inject auth headers
  onRequest: ({ request }) => {
    const authenticatedUserJSON = localStorage.getItem('activeTigger.auth');
    const authenticatedUser = authenticatedUserJSON ? JSON.parse(authenticatedUserJSON) : null;
    if (authenticatedUser) {
      const authHeaders = getAuthHeaders(authenticatedUser);
      if (authHeaders) {
        toPairs(authHeaders.headers).map(([header, value]) => {
          if (request.headers.get(header) === null) request.headers.set(header, value);
        });
        //params.header = { ...params.header, username: authenticatedUser.username };
      }
      return request;
    }
    return undefined;
  },
};

api.use(authMiddleware);

/**
 * Authentication methods
 * login and me are standard async functions and not hooks.
 * Because they are used directly by the auth centralized mechanism which is itself a hook/context.
 */

/**
 * login : POST a login form data to get an auth token
 * @param params LoginParams
 * @returns an access_token
 */
export async function login(params: LoginParams) {
  const res = await api.POST('/token', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    bodySerializer: (body) => new URLSearchParams(body as Record<string, string>),
  });

  if (res.data && !res.error) return res.data;
  else {
    console.log(res.error);
    throw new HttpError(
      res.response.status,
      // TODO: debug API type for error, data received are not coherent with types
      res.error.detail + '',
    );
  }
}

/**
 * logout : POST a login form data to get an auth token
 * @param params LoginParams
 * @returns an access_token
 */
export async function logout(token: string) {
  const res = await api.POST('/users/disconnect', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.response.status === 200) return true;
  else {
    console.log(res.error);
    throw new HttpError(
      res.response.status,
      // TODO: debug API type for error, data received are not coherent with types
      'could not logout',
    );
  }
}

/**
 * me : GET an authenticated user info
 * @param token
 * @returns user
 */
export async function me(token: string) {
  const res = await api.GET('/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.data) return res.data;
  else throw new HttpError(res.response.status, '');
}

/**
 * HOOKS
 * We use hooks functions for API calls to be able to use the useAuth hook inside of it.
 * It allows us also to use an internal state (handled by useAsyncMemo) for getters which simplifies the component code.
 */

/**
 * useUserProjects
 * retrieve authenticated user's projects list
 * @returns AvailableProjectsModel[] | undefined
 */
export function useUserProjects(): AvailableProjectsModel[] | undefined {
  const { notify } = useNotifications();

  // This method is a GET it retrieves data by querying the API
  // but a hook can not be async it has to be a pure function
  // to handle the query API effect we use useAsyncMemo
  // useAsyncMemo generalizes the internal state management for us
  // useAsyncMemo internally has a generic useState and a useEffect
  // we use useAsyncMemo to lighten our API methods and our component code by providing a ready to consume state
  const projects = useAsyncMemo(async () => {
    // api calls uses openapi fetch that make sure that method GET, paths `/projects` and params respect API specs
    const res = await api.GET('/projects');
    if (res.data && !res.error)
      // TODO: type API response in Python code and remove the as unknown as AvailableProjectsModel[]
      return values(res.data.projects) as unknown as AvailableProjectsModel[];
    else {
      notify({ type: 'error', message: JSON.stringify(res.error) });
      throw new HttpError(res.response.status, '');
    }
  }, []);

  // here we use the getAsyncMemoData to return only the data or undefined and not the internal status
  return getAsyncMemoData(projects);
}

/**
 * useCreateProject
 * provide a method to POST a new project
 * @returns void
 */
export function useCreateProject() {
  const { notify } = useNotifications();

  // POST method hook generates an async function which will do the API call
  // the component using this hook will decide when to use this method  in its lifecycle
  // (typically in a form submit handler)
  // useCallback is a react util which memoizes a function
  // the createProject function will change each time the authenticated user changes
  // therefore the component using this hook will not have to bother handling authentication it's done automatically here
  const createProject = useCallback(
    // this async function needs a ProjectDataModel payload as params
    async (project: ProjectDataModel) => {
      // do the new projects POST call
      const res = await api.POST('/projects/new', {
        // POST has a body
        body: project,
      });
      if (!res.error) notify({ type: 'success', message: 'Project created' });
      else
        throw new Error(
          res.error.detail ? res.error.detail?.map((d) => d.msg).join('; ') : res.error.toString(),
        );
    },
    [notify],
  );
  // this POST hook returns a function ready to be used by a component
  return createProject;
}

/**
 * Create test set
 */
export function useCreateTestSet() {
  const { notify } = useNotifications();
  const createTestSet = useCallback(
    async (projectSlug: string, testset: TestSetDataModel) => {
      // do the new projects POST call
      const res = await api.POST('/projects/testset', {
        // POST has a body
        params: {
          query: { project_slug: projectSlug },
        },
        body: testset,
      });
      if (!res.error) notify({ type: 'success', message: 'Test data set uploaded' });
      else
        throw new Error(
          res.error.detail ? res.error.detail?.map((d) => d.msg).join('; ') : res.error.toString(),
        );
    },
    [notify],
  );
  return createTestSet;
}

/**
 * useDeleteProject
 * provide a method to delete existing projext
 * @returns void
 */
export function useDeleteProject() {
  const { notify } = useNotifications();
  const deleteProject = useCallback(
    async (projectSlug: string) => {
      // do the new projects POST call
      const res = await api.POST('/projects/delete', {
        params: {
          query: { project_slug: projectSlug },
        },
      });
      if (!res.error) notify({ type: 'success', message: 'Project deleted' });
    },
    [notify],
  );

  return deleteProject;
}

/**
 * useStatistics
 * GET the current stats of the project
 * @param projectSlug
 * @param currentScheme
 */
export function useStatistics(projectSlug: string | null, currentScheme: string | null) {
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  const getStatistics = useAsyncMemo(async () => {
    if (projectSlug && currentScheme) {
      const res = await api.GET('/projects/{project_slug}/statistics', {
        params: {
          path: { project_slug: projectSlug },
          query: { scheme: currentScheme },
        },
      });

      //return res.data.params;
      return res.data;
    }
    //TODO: notify
    return null;
    // in this dependencies list we add projectSlug has a different API call will be made if it changes
    // we also add the fetchTrigger state in the dependencies list to make sur that any change to this boolean triggers a new API call
  }, [projectSlug, currentScheme, fetchTrigger]);

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);

  return { statistics: getAsyncMemoData(getStatistics), reFetchStatistics: reFetch };
}

/**
 * useProject
 * GET project by projectSlug
 * @param projectSlug
 * @returns ProjectModel
 */
export function useProject(projectSlug?: string) {
  // it's a GET data hook. It's using the exact same pattern as useUserProjects but we has a reFetch method
  // reFetch method should trigger a new API call to update the data from API

  // 1. auth is automatically managed by an API middleware see core/auth.tsx

  // 2. create a fetchTrigger, a simple boolean which we will use to trigger an API call
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  // 3. use an internal state to store the project thanks to useAsyncMemo
  const project = useAsyncMemo(async () => {
    if (projectSlug) {
      const res = await api.GET('/projects/{project_slug}', {
        params: {
          path: { project_slug: projectSlug },
        },
      });

      //return res.data.params;
      return res.data;
    }
    return null;
    // in this dependencies list we add projectSlug has a different API call will be made if it changes
    // we also add the fetchTrigger state in the dependencies list to make sur that any change to this boolean triggers a new API call
  }, [projectSlug, fetchTrigger]);

  // 4. make sure to simplify the data returned by discarding the status
  // we also return a refetch method which toggle the fetchTrigger state in order to trigger a new API call

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);
  return { project: getAsyncMemoData(project), reFetch };
}

/**
 * delete a scheme
 (its a hook)
 */
export function useDeleteScheme(projectSlug: string, schemeName: string | null) {
  const { notify } = useNotifications();

  const deleteScheme = useCallback(async () => {
    if (schemeName) {
      // do the new projects POST call
      const res = await api.POST('/schemes/{action}', {
        params: {
          path: { action: 'delete' },
          query: { project_slug: projectSlug },
        },
        body: { project_slug: projectSlug, name: schemeName, tags: null },
      });
      if (!res.error) notify({ type: 'success', message: 'Scheme deleted' });
    }
  }, [projectSlug, schemeName, notify]);

  return deleteScheme;
}

/**
 * create a scheme
 * (its a hook)
 */
export function useAddScheme(projectSlug: string) {
  const { notify } = useNotifications();

  const addScheme = useCallback(
    async (schemeName: string) => {
      if (schemeName) {
        // do the new projects POST call
        const res = await api.POST('/schemes/{action}', {
          params: {
            path: { action: 'add' },
            query: { project_slug: projectSlug },
          },
          body: { project_slug: projectSlug, name: schemeName, tags: null },
        });
        if (!res.error) notify({ type: 'success', message: 'Scheme add' });

        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return addScheme;
}

/**
 * create a feature
 **/
export function useAddFeature(projectSlug: string | null) {
  const { notify } = useNotifications();

  const addFeature = useCallback(
    async (
      featureType: string,
      featureName: string,
      featureParameters: Record<string, string | number | undefined> | null,
    ) => {
      // TODO fix types

      console.log('add features');

      if (!featureName) featureName = featureType;

      if (featureType && featureParameters && projectSlug) {
        const res = await api.POST('/features/add', {
          params: {
            query: { project_slug: projectSlug },
          },
          body: { name: featureName, type: featureType, parameters: featureParameters },
        });
        if (!res.error) notify({ type: 'warning', message: 'Features are under computation...' });
        return true;
      }
      return false;
    },
    [projectSlug, notify],
  );

  return addFeature;
}

/**
 * delete a feature
 * @param projectSlug
 * @returns deleteFeature
 *  */
export function useDeleteFeature(projectSlug: string | null) {
  const { notify } = useNotifications();

  const deleteFeature = useCallback(
    async (featureName: string | null) => {
      if (featureName && projectSlug) {
        const res = await api.POST('/features/delete', {
          params: {
            query: { project_slug: projectSlug, name: featureName },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Features deleted' });
        return true;
      }
      return false;
    },
    [projectSlug, notify],
  );

  return deleteFeature;
}

/**
 * Get the id of the next element
 * with a specific configuration of selection
 *
 * @param projectSlug
 * @param currentScheme
 * @param selectionConfig
 * @returns ElementId
 */
export function useGetNextElementId(
  projectSlug: string | null,
  currentScheme: string | null,
  selectionConfig: {
    mode: string;
    sample: string;
    label?: string;
    filter?: string;
    frameSelection?: boolean;
    frame?: number[];
  },
  history: string[],
  phase: string,
) {
  const { notify } = useNotifications();
  const getNextElementId = useCallback(async () => {
    if (projectSlug && currentScheme) {
      const res = await api.POST('/elements/next', {
        params: { query: { project_slug: projectSlug } },
        body: {
          scheme: currentScheme,
          selection: phase == 'test' ? 'test' : selectionConfig.mode,
          sample: selectionConfig.sample,
          tag: selectionConfig.label,
          filter: selectionConfig.filter,
          history: history,
          frame: selectionConfig.frameSelection ? selectionConfig.frame : [], // only if frame option selected
        },
      });
      return res.data?.element_id;
    } else {
      notify({ type: 'error', message: 'Select a project/scheme to get elements' });
      return null;
    }
  }, [projectSlug, currentScheme, notify, history, selectionConfig, phase]);

  return { getNextElementId };
}

/**
 * Get element content by specific id
 */
export function useGetElementById(projectSlug: string | null, currentScheme: string | null) {
  const getElementById = useCallback(
    async (elementId: string, dataset: string) => {
      if (projectSlug && currentScheme) {
        const res = await api.GET('/elements/{element_id}', {
          params: {
            path: { element_id: elementId },
            query: { project_slug: projectSlug, scheme: currentScheme, dataset: dataset },
          },
        });
        console.log(res.error);
        if (!res.error) return res.data;
      }
      return null;
    },
    [projectSlug, currentScheme],
  );

  return { getElementById };
}

/**
 * add an annotation
 */
export function useAddAnnotation(
  projectSlug: string | null,
  scheme: string | null,
  dataset: string,
) {
  const addAnnotation = useCallback(
    async (element_id: string, label: string) => {
      // do the new projects POST call
      if (projectSlug && scheme) {
        await api.POST('/annotation/{action}', {
          params: {
            path: { action: 'add' },
            query: { project_slug: projectSlug },
          },
          body: {
            project_slug: projectSlug,
            element_id: element_id,
            label: label,
            scheme: scheme,
            dataset: dataset,
          },
        });
        //if (!res.error) notify({ type: 'success', message: 'Annotation added' });

        return true;
      }
      return false;
    },
    [projectSlug, scheme, dataset],
  );

  return { addAnnotation };
}

/**
 * add a table of annotations
 */
export function useAddTableAnnotations(
  projectSlug: string | null,
  scheme: string | null,
  dataset: string | null,
) {
  const { notify } = useNotifications();

  const addTableAnnotations = useCallback(
    async (table: AnnotationModel[]) => {
      if (projectSlug && scheme) {
        const res = await api.POST('/annotation/table', {
          params: {
            query: { project_slug: projectSlug },
          },
          body: {
            annotations: table,
            dataset: dataset ? dataset : 'train',
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Annotations added' });

        return true;
      }
      return false;
    },
    [projectSlug, scheme, notify, dataset],
  );

  return { addTableAnnotations };
}

/**
 * create a new label
 */
export function useAddLabel(projectSlug: string | null, scheme: string | null) {
  const { notify } = useNotifications();

  const addLabel = useCallback(
    async (label: string) => {
      if (projectSlug && scheme) {
        const res = await api.POST('/schemes/label/add', {
          params: {
            query: { project_slug: projectSlug, scheme: scheme, label: label },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'New label created' });

        return true;
      }
      return false;
    },
    [projectSlug, scheme, notify],
  );

  return { addLabel };
}

/**
 * Delete a label
 */
export function useDeleteLabel(projectSlug: string | null, scheme: string | null) {
  const { notify } = useNotifications();

  const deleteLabel = useCallback(
    async (label: string) => {
      if (projectSlug && scheme) {
        const res = await api.POST('/schemes/label/delete', {
          params: {
            query: { project_slug: projectSlug, scheme: scheme, label: label },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Label deleted' });

        return true;
      }
      return false;
    },
    [projectSlug, scheme, notify],
  );

  return { deleteLabel };
}

/**
 * Rename a label
 */
export function useRenameLabel(projectSlug: string | null, scheme: string | null) {
  const { notify } = useNotifications();

  const renameLabel = useCallback(
    async (formerLabel: string, newLabel: string) => {
      if (projectSlug && scheme) {
        const res = await api.POST('/schemes/label/rename', {
          params: {
            query: {
              project_slug: projectSlug,
              scheme: scheme,
              former_label: formerLabel,
              new_label: newLabel,
            },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Label renamed' });
        else notify({ type: 'error', message: 'Error when renamed' });
      }

      return true;
    },
    [projectSlug, scheme, notify],
  );

  return { renameLabel };
}

export function useUpdateSimpleModel(projectSlug: string | null, scheme: string | null) {
  const { notify } = useNotifications();

  const updateSimpleModel = useCallback(
    async (formData: SimpleModelModel) => {
      if (projectSlug && formData.features && scheme && formData.model && formData.params) {
        const res = await api.POST('/models/simplemodel', {
          params: {
            query: {
              project_slug: projectSlug,
            },
          },
          body: {
            features: formData.features,
            scheme: scheme,
            model: formData.model,
            params: formData.params,
            standardize: true,
          },
        });

        if (!res.error) notify({ type: 'warning', message: 'Model under training' });
      }
      return true;
    },
    [projectSlug, scheme, notify],
  );

  return { updateSimpleModel };
}

/**
 * Get users for a project
 */
export function useUsersAuth(projectSlug: string | null) {
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  const { notify } = useNotifications();
  const getProjectUsers = useAsyncMemo(async () => {
    if (projectSlug) {
      const res = await api.GET('/auth/project', {
        params: { query: { project_slug: projectSlug } },
      });
      if (!res.error) return res.data.auth;
    }
    return null;
  }, [notify, projectSlug, fetchTrigger]);

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);

  return { authUsers: getAsyncMemoData(getProjectUsers), reFetchUsersAuth: reFetch };
}

/**
 * Delete a user auth
 */
export function useDeleteUserAuthProject(projectSlug: string | null, reFetchUsersAuth: () => void) {
  const { notify } = useNotifications();
  const deleteUserAuth = useCallback(
    async (username: string | null) => {
      if (projectSlug && username) {
        const res = await api.POST('/users/auth/{action}', {
          params: {
            path: { action: 'delete' },
            query: { project_slug: projectSlug, username: username },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Auth deleted for user' });
        reFetchUsersAuth();
        return true;
      }
      return null;
    },
    [projectSlug, notify, reFetchUsersAuth],
  );

  return { deleteUserAuth };
}

/**
 * Get all users
 */
export function useUsers() {
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  const users = useAsyncMemo(async () => {
    const res = await api.GET('/users', {});
    if (!res.error) return res.data.users as unknown as string[];
    return null;
  }, [fetchTrigger]);

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);

  return { users: getAsyncMemoData(users), reFetchUsers: reFetch };
}

/**
 * Create a user
 */
export function useCreateUser(reFetchUsers: () => void) {
  // TODO :  check the strengh of the password
  const { notify } = useNotifications();

  const createUser = useCallback(
    async (username: string, password: string, status: string) => {
      const res = await api.POST('/users/create', {
        params: {
          query: { username_to_create: username, password: password, status: status },
        },
      });
      if (!res.error) notify({ type: 'success', message: 'User created' });
      reFetchUsers();
      return true;
    },
    [notify, reFetchUsers],
  );

  return { createUser };
}

/**
 * Delete a user
 */
export function useDeleteUser(reFetchUsers: () => void) {
  const { notify } = useNotifications();

  const deleteUser = useCallback(
    async (username: string | null) => {
      if (username) {
        const res = await api.POST('/users/delete', {
          params: {
            query: { user_to_delete: username },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'User deleted' });
        reFetchUsers();
        return true;
      }
      return null;
    },
    [notify, reFetchUsers],
  );

  return { deleteUser };
}

/**
 * Create user auth
 */
export function useAddUserAuthProject(projectSlug: string | null, reFetchUsersAuth: () => void) {
  const { notify } = useNotifications();
  const addUserAuth = useCallback(
    async (username: string, auth: string) => {
      if (projectSlug && username) {
        const res = await api.POST('/users/auth/{action}', {
          params: {
            path: { action: 'add' },
            query: { project_slug: projectSlug, username: username, status: auth },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Auth deleted for user' });
        reFetchUsersAuth();
        return true;
      }
      return null;
    },
    [projectSlug, notify, reFetchUsersAuth],
  );

  return { addUserAuth };
}

/**
 * Train a new bert project
 */
export function useTrainBertModel(projectSlug: string | null, scheme: string | null) {
  const { notify } = useNotifications();
  const trainBertModel = useCallback(
    async (dataForm: newBertModel) => {
      if (projectSlug && scheme && dataForm) {
        const res = await api.POST('/models/bert/train', {
          params: {
            query: { project_slug: projectSlug },
          },
          body: {
            project_slug: projectSlug,
            scheme: scheme,
            base_model: dataForm.base,
            name: dataForm.name || '',
            test_size: 0.2,
            params: dataForm.parameters,
          },
        });
        if (!res.error) notify({ type: 'warning', message: 'Starting bertmodel training' });
        return true;
      }
      return null;
    },
    [projectSlug, notify, scheme],
  );

  return { trainBertModel };
}

/**
 * Rename bert model
 */
export function useRenameBertModel(projectSlug: string | null) {
  const { notify } = useNotifications();
  const renameBertModel = useCallback(
    async (former_model_name: string, new_model_name: string) => {
      if (projectSlug) {
        const res = await api.POST('/models/bert/rename', {
          params: {
            query: {
              project_slug: projectSlug,
              former_name: former_model_name,
              new_name: new_model_name,
            },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Model renamed' });
        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return { renameBertModel };
}

/**
 * Delete bert model
 */
export function useDeleteBertModel(projectSlug: string | null) {
  const { notify } = useNotifications();
  const deleteBertModel = useCallback(
    async (model_name: string) => {
      if (projectSlug) {
        const res = await api.POST('/models/bert/delete', {
          params: {
            query: {
              project_slug: projectSlug,
              bert_name: model_name,
            },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Model deleted' });
        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return { deleteBertModel };
}

/**
 * Get model informations
 */
export function useModelInformations(project_slug: string | null, model_name: string | null) {
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  const modelInformations = useAsyncMemo(async () => {
    if (model_name && project_slug) {
      const res = await api.GET('/models/bert', {
        params: { query: { project_slug: project_slug, name: model_name } },
      });
      if (!res.error) return res.data;
    }
    return null;
  }, [fetchTrigger, model_name]);

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);

  return { model: getAsyncMemoData(modelInformations), reFetchModelInformation: reFetch };
}

/**
 * Compute model prediction
 */
export function useComputeModelPrediction(projectSlug: string | null) {
  const { notify } = useNotifications();
  const computeModelPrediction = useCallback(
    async (model_name: string) => {
      if (projectSlug) {
        const res = await api.POST('/models/bert/predict', {
          params: {
            query: {
              project_slug: projectSlug,
              model_name: model_name,
            },
          },
        });
        if (!res.error)
          notify({ type: 'warning', message: 'Computing prediction. It can take some time.' });
        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return { computeModelPrediction };
}

/**
 * Get file features
 */
export function useGetFeaturesFile(projectSlug: string | null) {
  const { notify } = useNotifications();
  const getFeaturesFile = useCallback(
    async (features: string[], format: string) => {
      if (projectSlug) {
        const res = await api.GET('/export/features', {
          params: {
            query: {
              project_slug: projectSlug,
              features: features,
              format: format,
            },
          },
          parseAs: 'blob',
        });
        console.log(res);

        if (!res.error) {
          notify({ type: 'success', message: 'Exporting the predictions of the model' });
          saveAs(res.data, 'features.' + format);
        }
        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return { getFeaturesFile };
}

/**
 * Get file annotations
 */
export function useGetAnnotationsFile(projectSlug: string | null) {
  const { notify } = useNotifications();
  const getAnnotationsFile = useCallback(
    async (scheme: string, format: string) => {
      if (projectSlug) {
        const res = await api.GET('/export/data', {
          params: {
            query: {
              project_slug: projectSlug,
              scheme: scheme,
              format: format,
            },
          },
          parseAs: 'blob',
        });
        console.log(res);

        if (!res.error) {
          notify({ type: 'success', message: 'Exporting the annotated data' });
          saveAs(res.data, 'annotations.' + format);
        }
        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return { getAnnotationsFile };
}

/**
 * Get file predictions
 */
export function useGetPredictionsFile(projectSlug: string | null) {
  const { notify } = useNotifications();
  const getPredictionsFile = useCallback(
    async (model: string, format: string) => {
      if (projectSlug) {
        const res = await api.GET('/export/prediction', {
          params: {
            query: {
              project_slug: projectSlug,
              name: model,
              format: format,
            },
          },
          parseAs: 'blob',
        });
        console.log(res);

        if (!res.error) {
          notify({ type: 'success', message: 'Exporting the predictions data' });
          saveAs(res.data, 'predictions.' + format);
        }
        return true;
      }
      return null;
    },
    [projectSlug, notify],
  );

  return { getPredictionsFile };
}

/**
 * Get model file static url
 */
export function useGetModelUrl(projectSlug: string | null, model: string | null) {
  const getModelUrl = useAsyncMemo(async () => {
    if (projectSlug && model) {
      const res = await api.GET('/export/bert', {
        params: {
          query: {
            project_slug: projectSlug,
            name: model,
          },
        },
      });

      if (!res.error) {
        return config.api.url + res.data;
      }
      return null;
    }
    return null;
  }, [projectSlug, model]);
  return { modelUrl: getAsyncMemoData(getModelUrl) };
}

/**
 * Get table of elements
 */
interface PageInfo {
  pageIndex: number;
  pageSize: number;
}
export function useTableElements(
  project_slug?: string,
  scheme?: string,
  initialPage?: number | null,
  initialPageSize?: number | null,
  search?: string | null,
  sample?: string,
  dataset?: string,
) {
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    pageIndex: initialPage || 1,
    pageSize: initialPageSize || 10,
  });
  const [total, setTotal] = useState<number>(0);

  const getTableElements = useAsyncMemo(async () => {
    if (scheme && project_slug) {
      const res = await api.GET('/elements/table', {
        params: {
          query: {
            project_slug: project_slug,
            scheme: scheme,
            min: (pageInfo.pageIndex - 1) * pageInfo.pageSize,
            max: Math.min(pageInfo.pageIndex * pageInfo.pageSize, total),
            contains: search,
            mode: sample ? sample : 'all',
            dataset: dataset ? dataset : 'train',
          },
        },
      });
      if (!res.error) {
        setTotal(res.data.total);
        return res.data.items;
      }
    }
    return null;
  }, [scheme, pageInfo, search, sample]);

  return { table: getAsyncMemoData(getTableElements), total, getPage: setPageInfo };
}

/**
 * Post update projection
 */
export function useUpdateProjection(
  projectSlug: string | null | undefined,
  scheme: string | null | undefined,
) {
  const { notify } = useNotifications();

  const updateProjection = useCallback(
    async (formData: ProjectionInStrictModel) => {
      console.log('format');
      console.log(formData);
      if (projectSlug && formData.features && scheme && formData.params) {
        const res = await api.POST('/elements/projection/compute', {
          params: {
            query: {
              project_slug: projectSlug,
            },
          },
          body: {
            method: formData.method,
            features: formData.features,
            params: formData.params,
          },
        });
        if (!res.error) notify({ type: 'warning', message: 'Projection under training' });
      }
      return true;
    },
    [projectSlug, scheme, notify],
  );

  return { updateProjection };
}

/**
 * Get projection data
 */
export function useGetProjectionData(
  project_slug: string | undefined | null,
  scheme: string | undefined | null,
) {
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  const getProjectionData = useAsyncMemo(async () => {
    if (scheme && project_slug) {
      const res = await api.GET('/elements/projection', {
        params: { query: { project_slug: project_slug, scheme: scheme } },
      });
      if (!res.error) {
        if ('data' in res) return res.data;
        else return null;
      }
    }
    return null;
  }, [fetchTrigger, scheme]);

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);

  return { projectionData: getAsyncMemoData(getProjectionData), reFetchProjectionData: reFetch };
}

/**
 * Get queue
 */
export function useGetQueue(projectState: ProjectStateModel | null) {
  const [fetchTrigger, setFetchTrigger] = useState<boolean>(false);

  const getQueueState = useAsyncMemo(async () => {
    const res = await api.GET('/queue', {});
    if (!res.error) {
      if ('data' in res) return res.data;
      else return null;
    }
    return null;
  }, [fetchTrigger, projectState]);

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), []);

  return { queueState: getAsyncMemoData(getQueueState), reFetchQueueState: reFetch };
}

/**
 * Get table of disagreements
 */
export function useTableDisagreement(project_slug?: string, scheme?: string) {
  const getTable = useAsyncMemo(async () => {
    if (scheme && project_slug) {
      const res = await api.GET('/elements/reconciliate', {
        params: {
          query: {
            project_slug: project_slug,
            scheme: scheme,
          },
        },
      });
      if (!res.error && res.data) {
        return res.data;
      }
    }
    return null;
  }, [project_slug, scheme]);
  const data = getAsyncMemoData(getTable);
  return { tableDisagreement: data ? data.table : null, users: data ? data.users : null };
}

/**
 * Reconciliate annotations
 */
export function useReconciliate(projectSlug: string, scheme: string | null) {
  const { notify } = useNotifications();

  const postReconciliate = useCallback(
    async (element_id: string, label: string, users: string[]) => {
      if (scheme && projectSlug) {
        const res = await api.POST('/elements/reconciliate', {
          params: {
            query: {
              project_slug: projectSlug,
              users: users,
              scheme: scheme,
              element_id: element_id,
              label: label,
            },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Reconciliation done' });

        return true;
      }
      return null;
    },
    [projectSlug, scheme, notify],
  );

  return { postReconciliate };
}
