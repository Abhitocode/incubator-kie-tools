/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as React from "react";
import { PageSection } from "@patternfly/react-core/dist/js/components/Page";
import { Spinner } from "@patternfly/react-core/dist/js/components/Spinner";
import { Text, TextContent, TextVariants } from "@patternfly/react-core/dist/js/components/Text";
import { Bullseye } from "@patternfly/react-core/dist/js/layouts/Bullseye";
import { basename } from "path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EditorPageErrorPage } from "../editor/EditorPageErrorPage";
import { useRoutes } from "../navigation/Hooks";
import { QueryParams } from "../navigation/Routes";
import { OnlineEditorPage } from "../pageTemplate/OnlineEditorPage";
import { useQueryParam, useQueryParams } from "../queryParams/QueryParamsContext";
import {
  ImportableUrl,
  isPotentiallyGit,
  isSingleFile,
  UrlType,
  useClonableUrl,
  useImportableUrl,
  useImportableUrlValidation,
} from "./ImportableUrlHooks";
import { AdvancedImportModal, AdvancedImportModalRef } from "./AdvancedImportModalContent";
import { fetchSingleFileContent } from "./fetchSingleFileContent";
import { useGitHubClient } from "../github/Hooks";
import { AccountsDispatchActionKind, useAccountsDispatch } from "../accounts/AccountsContext";
import { useAuthSession, useAuthSessions } from "../authSessions/AuthSessionsContext";
import { useAuthProvider, useAuthProviders } from "../authProviders/AuthProvidersContext";
import { getCompatibleAuthSessionWithUrlDomain } from "../authSessions/CompatibleAuthSessions";
import { useWorkspaces } from "@kie-tools-core/workspaces-git-fs/dist/context/WorkspacesContext";
import { LocalFile } from "@kie-tools-core/workspaces-git-fs/dist/worker/api/LocalFile";
import { encoder } from "@kie-tools-core/workspaces-git-fs/dist/encoderdecoder/EncoderDecoder";
import { WorkspaceKind } from "@kie-tools-core/workspaces-git-fs/dist/worker/api/WorkspaceOrigin";
import { PromiseStateStatus } from "@kie-tools-core/react-hooks/dist/PromiseState";
import { AUTH_SESSION_NONE } from "../authSessions/AuthSessionApi";
import { useBitbucketClient } from "../bitbucket/Hooks";
import { AuthProviderGroup } from "../authProviders/AuthProvidersApi";
import { useGitlabClient } from "../gitlab/useGitlabClient";

export function NewWorkspaceFromUrlPage() {
  const workspaces = useWorkspaces();
  const routes = useRoutes();
  const navigate = useNavigate();
  const accountsDispatch = useAccountsDispatch();

  const [importingError, setImportingError] = useState("");

  const queryParams = useQueryParams();

  const queryParamUrl = useQueryParam(QueryParams.URL);
  const queryParamBranch = useQueryParam(QueryParams.BRANCH);
  const queryParamAuthSessionId = useQueryParam(QueryParams.AUTH_SESSION_ID);
  const queryParamInsecurelyDisableTlsCertificateValidation = useQueryParam(
    QueryParams.INSECURELY_DISABLE_TLS_CERTIFICATE_VALIDATION
  );
  const queryParamDisableEncodingValidation = useQueryParam(QueryParams.DISABLE_ENCODING);
  const queryParamConfirm = useQueryParam(QueryParams.CONFIRM);

  const authProviders = useAuthProviders();
  const { authSessions, authSessionStatus } = useAuthSessions();
  const { authSession, gitConfig, authInfo } = useAuthSession(queryParamAuthSessionId);
  const authProvider = useAuthProvider(authSession);
  const insecurelyDisableTlsCertificateValidation = useMemo(() => {
    if (typeof queryParamInsecurelyDisableTlsCertificateValidation === "string") {
      return queryParamInsecurelyDisableTlsCertificateValidation === "true";
    }
    return authProvider?.group === AuthProviderGroup.GIT
      ? authProvider.insecurelyDisableTlsCertificateValidation
      : false;
  }, [queryParamInsecurelyDisableTlsCertificateValidation, authProvider]);

  const disableEncodingValidation = useMemo(() => {
    if (typeof queryParamDisableEncodingValidation === "string") {
      return queryParamDisableEncodingValidation === "true";
    }
    return authProvider?.group === AuthProviderGroup.GIT ? authProvider.disableEncoding : false;
  }, [queryParamDisableEncodingValidation, authProvider]);

  const importableUrl = useImportableUrl(queryParamUrl);
  const clonableUrlObject = useClonableUrl(
    queryParamUrl,
    authInfo,
    queryParamBranch,
    insecurelyDisableTlsCertificateValidation,
    disableEncodingValidation
  );
  const { clonableUrl, selectedGitRefName, gitServerRefsPromise } = clonableUrlObject;

  const setAuthSessionId = useCallback(
    (newAuthSessionId: React.SetStateAction<string | undefined>) => {
      if (!newAuthSessionId) {
        navigate(
          {
            pathname: routes.import.path({}),
            search: queryParams.without(QueryParams.AUTH_SESSION_ID).toString(),
          },
          { replace: true }
        );
        return;
      }
      navigate(
        {
          pathname: routes.import.path({}),
          search: queryParams
            .with(
              QueryParams.AUTH_SESSION_ID,
              typeof newAuthSessionId === "function" ? newAuthSessionId(queryParamAuthSessionId) : newAuthSessionId
            )
            .toString(),
        },
        { replace: true }
      );

      accountsDispatch({ kind: AccountsDispatchActionKind.CLOSE });
    },
    [accountsDispatch, navigate, queryParamAuthSessionId, queryParams, routes.import]
  );

  const setUrl = useCallback(
    (newUrl) => {
      if (!newUrl) {
        navigate(
          {
            pathname: routes.import.path({}),
            search: queryParams.without(QueryParams.URL).toString(),
          },
          { replace: true }
        );
        return;
      }
      navigate(
        {
          pathname: routes.import.path({}),
          search: queryParams
            .with(QueryParams.URL, typeof newUrl === "function" ? newUrl(queryParamUrl ?? "") : newUrl)
            .toString(),
        },
        { replace: true }
      );
    },
    [navigate, queryParamUrl, queryParams, routes.import]
  );

  const setGitRefName = useCallback(
    (newGitRefName) => {
      if (!newGitRefName) {
        navigate(
          {
            pathname: routes.import.path({}),
            search: queryParams.without(QueryParams.BRANCH).toString(),
          },
          { replace: true }
        );
        return;
      }
      navigate(
        {
          pathname: routes.import.path({}),
          search: queryParams
            .with(
              QueryParams.BRANCH,
              typeof newGitRefName === "function" ? newGitRefName(selectedGitRefName ?? "") : newGitRefName
            )
            .toString(),
        },
        { replace: true }
      );
    },
    [navigate, queryParams, routes.import, selectedGitRefName]
  );

  const setInsecurelyDisableTlsCertificateValidation = useCallback(
    (newInsecurelyDisableTlsCertificateValidation) => {
      if (!newInsecurelyDisableTlsCertificateValidation) {
        navigate(
          {
            pathname: routes.import.path({}),
            search: queryParams.without(QueryParams.INSECURELY_DISABLE_TLS_CERTIFICATE_VALIDATION).toString(),
          },
          { replace: true }
        );
        return;
      }
      navigate(
        {
          pathname: routes.import.path({}),
          search: queryParams
            .with(
              QueryParams.INSECURELY_DISABLE_TLS_CERTIFICATE_VALIDATION,
              typeof newInsecurelyDisableTlsCertificateValidation === "function"
                ? newInsecurelyDisableTlsCertificateValidation(insecurelyDisableTlsCertificateValidation ?? false)
                : newInsecurelyDisableTlsCertificateValidation
            )
            .toString(),
        },
        { replace: true }
      );
    },
    [navigate, insecurelyDisableTlsCertificateValidation, queryParams, routes.import]
  );

  // Startup the page. Only import if those are set.
  useEffect(() => {
    if (!queryParamUrl) {
      return;
    }

    const { compatible } = getCompatibleAuthSessionWithUrlDomain({
      authProviders,
      authSessions,
      authSessionStatus,
      urlDomain: new URL(queryParamUrl).hostname,
    });

    let newQueryParams = queryParams;
    if (authSession?.id && AUTH_SESSION_NONE.id !== authSession?.id) {
      newQueryParams = newQueryParams.with(QueryParams.AUTH_SESSION_ID, authSession?.id);
    } else if (compatible.length > 0) {
      newQueryParams = newQueryParams.with(QueryParams.AUTH_SESSION_ID, compatible[0].id);
    }

    if (selectedGitRefName) {
      newQueryParams = newQueryParams.with(QueryParams.BRANCH, selectedGitRefName);
    }
    navigate(
      {
        pathname: routes.import.path({}),
        search: newQueryParams.toString(),
      },
      { replace: true }
    );
  }, [
    authProviders,
    authSession?.id,
    authSessionStatus,
    authSessions,
    navigate,
    queryParamUrl,
    queryParams,
    routes.import,
    selectedGitRefName,
    setGitRefName,
  ]);

  const cloneGitRepository: typeof workspaces.createWorkspaceFromGitRepository = useCallback(
    async (args) => {
      const res = await workspaces.createWorkspaceFromGitRepository(args);

      const { workspace, suggestedFirstFile } = res;

      if (!suggestedFirstFile) {
        navigate(
          {
            pathname: routes.home.path({}),
            search: routes.home.queryString({ expand: workspace.workspaceId }),
          },
          { replace: true }
        );
        return res;
      }

      navigate(
        {
          pathname: routes.workspaceWithFilePath.path({
            workspaceId: workspace.workspaceId,
            fileRelativePath: suggestedFirstFile.relativePath,
          }),
        },
        { replace: true }
      );
      return res;
    },
    [routes, navigate, workspaces]
  );

  const createWorkspaceForFile = useCallback(
    async (file: LocalFile) => {
      workspaces
        .createWorkspaceFromLocal({
          localFiles: [file],
          gitAuthSessionId: AUTH_SESSION_NONE.id,
        })
        .then(({ workspace, suggestedFirstFile }) => {
          if (!suggestedFirstFile) {
            return;
          }
          navigate(
            {
              pathname: routes.workspaceWithFilePath.path({
                workspaceId: workspace.workspaceId,
                fileRelativePath: suggestedFirstFile.relativePath,
              }),
            },
            { replace: true }
          );
        });
    },
    [routes, navigate, workspaces]
  );

  const gitHubClient = useGitHubClient(authSession);
  const bitbucketClient = useBitbucketClient(authSession);
  const gitlabClient = useGitlabClient(authSession);

  const doImportAsSingleFile = useCallback(
    async (importableUrl: ImportableUrl) => {
      const singleFileContent = await fetchSingleFileContent(
        importableUrl,
        gitHubClient,
        bitbucketClient,
        gitlabClient
      );

      if (singleFileContent.error) {
        setImportingError(singleFileContent.error);
        return;
      }

      await createWorkspaceForFile({
        path: basename(decodeURIComponent(singleFileContent.rawUrl!.pathname)),
        fileContents: encoder.encode(singleFileContent.content!),
      });
    },
    [bitbucketClient, createWorkspaceForFile, gitHubClient, gitlabClient]
  );

  const doImport = useCallback(async () => {
    const singleFile = isSingleFile(importableUrl.type);

    try {
      if (queryParamAuthSessionId && !authSession) {
        setImportingError(`Auth session '${queryParamAuthSessionId}' not found.`);
        return;
      }

      if (clonableUrl.type === UrlType.INVALID || clonableUrl.type === UrlType.NOT_SUPPORTED) {
        setImportingError(clonableUrl.error);
        return;
      }

      //unknown
      else if (importableUrl.type === UrlType.UNKNOWN) {
        if (gitServerRefsPromise.data?.defaultBranch) {
          await cloneGitRepository({
            origin: {
              kind: WorkspaceKind.GIT,
              url: importableUrl.url.toString(),
              branch: selectedGitRefName ?? gitServerRefsPromise.data.defaultBranch,
            },
            gitConfig,
            authInfo,
            gitAuthSessionId: queryParamAuthSessionId,
            insecurelyDisableTlsCertificateValidation,
            disableEncoding: disableEncodingValidation,
          });
        } else {
          await doImportAsSingleFile(importableUrl);
        }
      }

      // git but not gist or snippet
      else if (
        importableUrl.type === UrlType.GITHUB_DOT_COM ||
        importableUrl.type === UrlType.BITBUCKET_DOT_ORG ||
        importableUrl.type === UrlType.GITLAB_DOT_COM ||
        importableUrl.type === UrlType.GIT
      ) {
        if (gitServerRefsPromise.data?.defaultBranch) {
          await cloneGitRepository({
            origin: {
              kind: WorkspaceKind.GIT,
              url: importableUrl.url.toString(),
              branch: selectedGitRefName ?? gitServerRefsPromise.data.defaultBranch,
            },
            gitAuthSessionId: queryParamAuthSessionId,
            gitConfig,
            authInfo,
            insecurelyDisableTlsCertificateValidation,
            disableEncoding: disableEncodingValidation,
          });
        } else {
          setImportingError(`Can't clone. ${gitServerRefsPromise.error}`);
          return;
        }
      }

      // gist
      else if (importableUrl.type === UrlType.GIST_DOT_GITHUB_DOT_COM) {
        importableUrl.url.hash = "";

        if (gitServerRefsPromise.data?.defaultBranch) {
          await cloneGitRepository({
            origin: {
              kind: WorkspaceKind.GITHUB_GIST,
              url: importableUrl.url.toString(),
              branch: queryParamBranch ?? selectedGitRefName ?? gitServerRefsPromise.data.defaultBranch,
            },
            gitAuthSessionId: queryParamAuthSessionId,
            gitConfig,
            authInfo,
            insecurelyDisableTlsCertificateValidation,
            disableEncoding: disableEncodingValidation,
          });
        } else {
          setImportingError(`Can't clone. ${gitServerRefsPromise.error}`);
          return;
        }
      }

      // snippet
      else if (
        importableUrl.type === UrlType.BITBUCKET_DOT_ORG_SNIPPET ||
        importableUrl.type === UrlType.GITLAB_DOT_COM_SNIPPET
      ) {
        importableUrl.url.hash = "";
        if (gitServerRefsPromise.data?.defaultBranch) {
          await cloneGitRepository({
            origin: {
              kind:
                importableUrl.type === UrlType.BITBUCKET_DOT_ORG_SNIPPET
                  ? WorkspaceKind.BITBUCKET_SNIPPET
                  : WorkspaceKind.GITLAB_SNIPPET,
              url: importableUrl.url.toString(),
              branch: queryParamBranch ?? selectedGitRefName ?? gitServerRefsPromise.data.defaultBranch,
            },
            gitAuthSessionId: queryParamAuthSessionId,
            gitConfig,
            authInfo,
            insecurelyDisableTlsCertificateValidation,
            disableEncoding: disableEncodingValidation,
          });
        } else {
          setImportingError(`Can't clone. ${gitServerRefsPromise.error}`);
          return;
        }
      }

      // single file
      else if (singleFile) {
        doImportAsSingleFile(importableUrl);
      } else {
        throw new Error("Invalid UrlType " + importableUrl.type);
      }
    } catch (e) {
      console.error(e);
      setImportingError(e.toString());
      return;
    }
  }, [
    importableUrl,
    queryParamAuthSessionId,
    authSession,
    clonableUrl.type,
    clonableUrl.error,
    gitServerRefsPromise.data?.defaultBranch,
    gitServerRefsPromise.error,
    cloneGitRepository,
    selectedGitRefName,
    gitConfig,
    authInfo,
    doImportAsSingleFile,
    queryParamBranch,
    insecurelyDisableTlsCertificateValidation,
    disableEncodingValidation,
  ]);

  useEffect(() => {
    if (!queryParamUrl || (importingError && queryParamAuthSessionId)) {
      navigate(
        {
          pathname: routes.import.path({}),
          search: queryParams.with(QueryParams.CONFIRM, "true").toString(),
        },
        { replace: true }
      );
    }
  }, [navigate, importingError, queryParamUrl, queryParams, queryParamAuthSessionId, routes.import]);

  useEffect(() => {
    if ((!queryParamBranch || !queryParamAuthSessionId) && selectedGitRefName) {
      return;
    }

    if (gitServerRefsPromise.status === PromiseStateStatus.PENDING) {
      return;
    }

    if (!queryParamUrl || (isPotentiallyGit(importableUrl.type) && queryParamConfirm === "true")) {
      advancedImportModalRef.current?.open();
      return;
    }

    setImportingError("");
    doImport();
  }, [
    gitServerRefsPromise.status,
    doImport,
    queryParamConfirm,
    importableUrl.type,
    queryParamUrl,
    queryParamBranch,
    queryParamAuthSessionId,
    selectedGitRefName,
  ]);

  const validation = useImportableUrlValidation(authSession, queryParamUrl, queryParamBranch, clonableUrlObject);
  const advancedImportModalRef = useRef<AdvancedImportModalRef>(null);

  return (
    <>
      <OnlineEditorPage>
        <PageSection variant={"light"} isFilled={true} padding={{ default: "noPadding" }}>
          {importingError && (
            <EditorPageErrorPage
              title={`Can't import`}
              path={importableUrl.url?.toString() ?? ""}
              errors={[importingError]}
            />
          )}
          {!importingError && queryParamConfirm !== "true" && queryParamUrl && (
            <Bullseye>
              <TextContent>
                <Bullseye>
                  <Spinner />
                </Bullseye>
                <br />
                <Text component={TextVariants.p}>{`Importing '${queryParamUrl}'`}</Text>
              </TextContent>
            </Bullseye>
          )}
          {(queryParamConfirm === "true" || !queryParamUrl) && (
            <AdvancedImportModal
              ref={advancedImportModalRef}
              onSubmit={() => {
                navigate(
                  {
                    pathname: routes.import.path({}),
                    search: queryParams.without(QueryParams.CONFIRM).toString(),
                  },
                  { replace: true }
                );
              }}
              onClose={() => {
                navigate({ pathname: routes.home.path({}) });
              }}
              clonableUrl={clonableUrlObject}
              validation={validation}
              authSessionId={queryParamAuthSessionId}
              url={queryParamUrl ?? ""}
              gitRefName={selectedGitRefName ?? ""}
              insecurelyDisableTlsCertificateValidation={insecurelyDisableTlsCertificateValidation ?? false}
              setAuthSessionId={setAuthSessionId}
              setUrl={setUrl}
              setGitRefName={setGitRefName}
              setInsecurelyDisableTlsCertificateValidation={setInsecurelyDisableTlsCertificateValidation}
            />
          )}
        </PageSection>
      </OnlineEditorPage>
    </>
  );
}
