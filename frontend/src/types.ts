import { ReactNode } from 'react';

import { components } from './generated/openapi';

/**
 * API data types
 * this file rename API data types from the generated ones to make our code cleaner
 * Types are generated in a components['schemas'] map which is hideous
 * we extract what we use little by little when needed
 */

export type UserModel = components['schemas']['UserModel'];

export type ProjectModel = components['schemas']['ProjectModel'];
export type ProjectBaseModel = components['schemas']['ProjectBaseModel'];
export type ProjectStateModel = components['schemas']['ProjectStateModel'];
export type ElementOutModel = components['schemas']['ElementOutModel'];

export type AvailableProjectsModel = {
  created_by: string;
  created_at: string;
  parameters: ProjectModel;
  size: number;
};
export type LoginParams = components['schemas']['Body_login_for_access_token_token_post'];

/**
 * Notifications
 */
export interface NotificationData {
  title?: ReactNode;
  message: ReactNode;
  type: 'success' | 'info' | 'warning' | 'error';
}

export type NotificationType = NotificationData & { id: number; createdAt: Date };

export type SchemeModel = components['schemas']['SchemeModel'];

export type FeatureModel = components['schemas']['FeatureModel'];

export type RequestNextModel = components['schemas']['NextInModel'];

export type AnnotationModel = components['schemas']['AnnotationModel'];
export type TableAnnotationsModel = components['schemas']['TableAnnotationsModel'];

export type SimpleModelModel = components['schemas']['SimpleModelModel'];

export type UsersServerModel = components['schemas']['UsersServerModel'];

export type LMParametersModel = components['schemas']['LMParametersModel'];

export type TestSetDataModel = components['schemas']['TestSetDataModel'];

export type AnnotationsDataModel = components['schemas']['AnnotationsDataModel'];

export type ProjectionInStrictModel = components['schemas']['ProjectionInStrictModel'];

export type GenerationModelApi = components['schemas']['GenerationModelApi'];

export type ProjectUpdateModel = components['schemas']['ProjectUpdateModel'];

export type TextDatasetModel = components['schemas']['TextDatasetModel'];

export type ProjectionModelParams =
  | components['schemas']['TsneModel']
  | components['schemas']['UmapModel'];

export interface FeatureDfmParameters {
  dfm_tfidf: string;
  ngrams: number;
  dfm_ngrams: number;
  dfm_min_term_freq: number;
  dfm_max_term_freq: number;
  dfm_norm: string;
  dfm_log: string;
}

export interface FeatureRegexParameters {
  value: string;
}

export interface FeatureDatasetParameters {
  dataset_type: string;
  dataset_col: string;
}

export interface FeatureFasttextParameters {
  model?: string;
}

export interface FeatureSbertParameters {
  model?: string;
}

export interface FeatureModelExtended {
  name: string;
  type: string;
  parameters:
    | null
    | FeatureSbertParameters
    | FeatureDfmParameters
    | FeatureRegexParameters
    | FeatureDatasetParameters
    | FeatureFasttextParameters;
}

export interface SelectionConfig {
  mode: string;
  sample: string;
  label?: string;
  frame?: number[];
  frameSelection?: boolean; // true/false to use frame to select
  filter?: string;
}

export interface GenerateConfig {
  api?: string;
  endpoint?: string;
  token?: string;
  prompt?: string;
  promptId?: string;
  n_batch?: number;
  selectionMode?: string;
  selectedModel?: GenModel & { api: string };
}

export interface DisplayConfig {
  displayAnnotation: boolean;
  displayPrediction: boolean;
  displayContext: boolean;
  displayHistory: boolean;
  frameSize: number;
}

export interface newBertModel {
  name?: string;
  base: string;
  parameters: LMParametersModel;
  dichotomize?: string;
  class_balance?: boolean;
  class_min_freq?: number;
  test_size?: number;
}

export interface TestSetModel {
  col_id: string;
  col_text: string;
  col_label?: string | null;
  scheme?: string | null;
  n_test: number;
}

export type SupportedAPI = 'Ollama' | 'OpenAI' | 'HuggingFace';

export type GenModelAPI = { models: GenModel[] } & (
  | {
      name: 'Ollama';
      endpoint: string;
    }
  | {
      name: 'OpenAI';
      credentials: string;
    }
  | {
      name: 'HuggingFace';
      endpoint: string;
      credentials: string;
    }
);

export interface GenModel {
  id: number;
  slug: string;
  name: string;
  endpoint?: string;
  credentials?: string;
}
