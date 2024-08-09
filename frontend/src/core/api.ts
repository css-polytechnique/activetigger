import { toPairs, values } from 'lodash';
import createClient, { Middleware } from 'openapi-fetch';
import { useCallback, useState } from 'react';

import type { paths } from '../generated/openapi';
import {
  AnnotationModel,
  AvailableProjectsModel,
  FeatureDfmParameters,
  LoginParams,
  ProjectDataModel,
  SelectionConfig,
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
        toPairs(authHeaders.headers).map(([header, value]) => request.headers.set(header, value));
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
    [],
  );
  // this POST hook returns a function ready to be used by a component
  return createProject;
}

/**
 * useDeleteProject
 * provide a method to delete existing projext
 * @returns void
 */
export function useDeleteProject() {
  const { notify } = useNotifications();
  const deleteProject = useCallback(async (projectSlug: string) => {
    // do the new projects POST call
    const res = await api.POST('/projects/delete', {
      params: {
        query: { project_slug: projectSlug },
      },
    });
    if (!res.error) notify({ type: 'success', message: 'Project deleted' });
  }, []);

  return deleteProject;
}

/**
 * useStatistics
 * GET the current stats of the project
 * @param projectSlug
 * @param currentScheme
 */
export function useStatistics(projectSlug: string, currentScheme: string | null) {
  const project = useAsyncMemo(async () => {
    if (projectSlug) {
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

    // in this dependencies list we add projectSlug has a different API call will be made if it changes
    // we also add the fetchTrigger state in the dependencies list to make sur that any change to this boolean triggers a new API call
  }, [projectSlug, currentScheme]);

  return { statistics: getAsyncMemoData(project) };
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

    // in this dependencies list we add projectSlug has a different API call will be made if it changes
    // we also add the fetchTrigger state in the dependencies list to make sur that any change to this boolean triggers a new API call
  }, [projectSlug, fetchTrigger]);

  // 4. make sure to simplify the data returned by discarding the status
  // we also return a refetch method which toggle the fetchTrigger state in order to trigger a new API call

  const reFetch = useCallback(() => setFetchTrigger((f) => !f), [projectSlug]);
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
    },
    [projectSlug, notify],
  );

  return addScheme;
}

/**
 * create a feature
 **/
export function useAddFeature(projectSlug: string) {
  const { notify } = useNotifications();

  const addFeature = useCallback(
    async (
      featureType: string,
      featureName: string,
      featureParameters: FeatureDfmParameters | any,
    ) => {
      // TODO fix types

      console.log('add features');

      if (!featureParameters) featureParameters = {};

      if (!featureName) featureName = featureType;

      if (featureType && featureParameters) {
        const res = await api.POST('/features/add', {
          params: {
            query: { project_slug: projectSlug },
          },
          body: { name: featureName, type: featureType, parameters: featureParameters },
        });
        if (!res.error) notify({ type: 'warning', message: 'Features are under computation...' });
        return true;
      }
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
export function useDeleteFeature(projectSlug: string) {
  const { notify } = useNotifications();

  const deleteFeature = useCallback(
    async (featureName: string | null) => {
      if (featureName) {
        const res = await api.POST('/features/delete', {
          params: {
            query: { project_slug: projectSlug, name: featureName },
          },
        });
        if (!res.error) notify({ type: 'success', message: 'Features deleted' });
        return true;
      }
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
export function useGetNextElementId(projectSlug: string, currentScheme: string) {
  const { notify } = useNotifications();
  const getNextElementId = useCallback(
    async (selectionConfig: SelectionConfig) => {
      const res = await api.POST('/elements/next', {
        params: { query: { project_slug: projectSlug } },
        body: {
          scheme: currentScheme,
          selection: selectionConfig.mode,
          sample: selectionConfig.sample,
          tag: selectionConfig.label,
          history: [],
        },
      });
      return res.data?.element_id;
    },
    [projectSlug, currentScheme, notify],
  );

  return { getNextElementId };
}

/**
 * Get element content by specific id
 * @param projectSlug
 * @param currentScheme
 * @param elementId
 * @returns
 
export function useGetElementById(projectSlug: string, currentScheme: string, elementId: string) {
  const { notify } = useNotifications();
  const nextElement = useAsyncMemo(async () => {
    const res = await api.GET('/elements/{element_id}', {
      params: {
        path: { element_id: elementId },
        query: { project_slug: projectSlug, scheme: currentScheme },
      },
    });
    return res.data;
  }, [projectSlug, currentScheme, notify]);

  return { nextElement: getAsyncMemoData(nextElement) };
}
*/
export function useGetElementById(projectSlug: string, currentScheme: string) {
  const { notify } = useNotifications();
  const getElementById = useCallback(
    async (elementId: string) => {
      const res = await api.GET('/elements/{element_id}', {
        params: {
          path: { element_id: elementId },
          query: { project_slug: projectSlug, scheme: currentScheme },
        },
      });
      if (!res.error) return res.data;
      else return null;
    },
    [projectSlug, currentScheme, notify],
  );

  return { getElementById };
}

/**
 * add an annotation
 */
export function useAddAnnotation(projectSlug: string, scheme: string, username: string) {
  const { notify } = useNotifications();

  const addAnnotation = useCallback(
    async (element_id: string, tag: string) => {
      // do the new projects POST call
      const res = await api.POST('/tags/{action}', {
        params: {
          path: { action: 'add' },
          query: { project_slug: projectSlug },
        },
        body: {
          project_slug: projectSlug,
          element_id: element_id,
          tag: tag,
          user: username,
          scheme: scheme,
        },
      });
      //if (!res.error) notify({ type: 'success', message: 'Annotation added' });

      return true;
    },
    [projectSlug, scheme, username, notify],
  );

  return { addAnnotation };
}

/**
 * create a new label
 */
export function useAddLabel(projectSlug: string, scheme: string) {
  const { notify } = useNotifications();

  const addLabel = useCallback(
    async (label: string) => {
      const res = await api.POST('/schemes/label/add', {
        params: {
          query: { project_slug: projectSlug, scheme: scheme, label: label },
        },
      });
      if (!res.error) notify({ type: 'success', message: 'New label created' });

      return true;
    },
    [projectSlug, scheme, notify],
  );

  return { addLabel };
}

/**
 * Delete a label
 */
export function useDeleteLabel(projectSlug: string, scheme: string) {
  const { notify } = useNotifications();

  const deleteLabel = useCallback(
    async (label: string) => {
      const res = await api.POST('/schemes/label/delete', {
        params: {
          query: { project_slug: projectSlug, scheme: scheme, label: label },
        },
      });
      if (!res.error) notify({ type: 'success', message: 'Label deleted' });

      return true;
    },
    [projectSlug, scheme, notify],
  );

  return { deleteLabel };
}

/**
 * Rename a label
 */
export function useRenameLabel(projectSlug: string, scheme: string) {
  const { notify } = useNotifications();

  const renameLabel = useCallback(
    async (formerLabel: string, newLabel: string) => {
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

      console.log(JSON.stringify(res));
      if (!res.error) notify({ type: 'success', message: 'Label renamed' });
      else notify({ type: 'error', message: 'Error when renamed' });

      return true;
    },
    [projectSlug, scheme, notify],
  );

  return { renameLabel };
}
