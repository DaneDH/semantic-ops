import { BumpType } from './config.schema';
import { COMMIT_MESSAGE_SEPARATOR } from './commits';

const SHORT_SHA_LENGTH = 7;

export interface SemanticOpsOutputs {
  version: string;
  previous_version: string;
  bump_type: BumpType;
  postfix: string;
  build_number: string;
  run_id: string;
  sha: string;
  tag_name: string;
  commit_messages: string;
}

export function shortSha(sha: string, length = SHORT_SHA_LENGTH): string {
  return sha.slice(0, length);
}

export function buildOutputs(params: {
  version: string;
  previousVersion: string;
  bumpType: BumpType;
  postfix: string;
  sha: string;
  runId: number;
  runNumber: number;
  tagPrefix: string;
  commitMessages: string[];
}): SemanticOpsOutputs {
  return {
    version: params.version,
    previous_version: params.previousVersion,
    bump_type: params.bumpType,
    postfix: params.postfix,
    build_number: `${params.runNumber}.${shortSha(params.sha)}`,
    run_id: String(params.runId),
    sha: params.sha,
    tag_name: `${params.tagPrefix}${params.version}`,
    commit_messages: params.commitMessages.join(COMMIT_MESSAGE_SEPARATOR),
  };
}
