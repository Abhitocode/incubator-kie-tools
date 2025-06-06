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
import { Checkbox } from "@patternfly/react-core/dist/js/components/Checkbox";
import { ExpandableSection } from "@patternfly/react-core/dist/js/components/ExpandableSection";
import { Tooltip } from "@patternfly/react-core/dist/js/components/Tooltip";
import { forwardRef, ForwardRefRenderFunction, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useAppI18n } from "../../../i18n";
import { DeploymentStrategyKind } from "../../../openshift/deploy/types";
import { useOpenShift } from "../../../openshift/OpenShiftContext";
import { isSingleModuleProject } from "../../../project";
import { isServiceAccountConfigValid } from "../../../settings/serviceAccount/ServiceAccountConfig";
import { isServiceRegistryConfigValid } from "../../../settings/serviceRegistry/ServiceRegistryConfig";
import { useSettings } from "../../../settings/SettingsContext";
import { ConfirmDeployOptionsProps, ConfirmDeployOptionsRef } from "../ConfirmDeployModal";

const RefForwardingSwfDeployOptions: ForwardRefRenderFunction<ConfirmDeployOptionsRef, ConfirmDeployOptionsProps> = (
  props,
  forwardedRef
) => {
  const openshift = useOpenShift();
  const settings = useSettings();
  const { i18n } = useAppI18n();
  const [shouldUploadOpenApi, setShouldUploadOpenApi] = useState(false);
  const [shouldDeployAsProject, setShouldDeployAsProject] = useState(false);

  const canUploadOpenApi = useMemo(
    () =>
      isServiceAccountConfigValid(settings.serviceAccount.config) &&
      isServiceRegistryConfigValid(settings.serviceRegistry.config),
    [settings.serviceAccount.config, settings.serviceRegistry.config]
  );

  const canDeployAsProject = useMemo(() => isSingleModuleProject(props.workspace.files), [props.workspace.files]);

  useEffect(() => {
    setShouldDeployAsProject(canDeployAsProject);
  }, [canDeployAsProject]);

  useImperativeHandle(forwardedRef, () => {
    return {
      deploy: async () =>
        openshift.deploySwf({
          targetFile: props.workspaceFile,
          factoryArgs: {
            kind: shouldDeployAsProject
              ? DeploymentStrategyKind.KOGITO_PROJECT
              : DeploymentStrategyKind.KOGITO_SWF_MODEL,
          },
          shouldUploadOpenApi,
        }),
    };
  }, [openshift, props.workspaceFile, shouldDeployAsProject, shouldUploadOpenApi]);
  return (
    <>
      {i18n.openshift.confirmModal.body}
      <br />
      <br />
      <Tooltip
        content={
          "Cannot deploy as a project since your workspace does not seem to contain a single module project structure."
        }
        trigger={!canDeployAsProject ? "mouseenter click" : ""}
      >
        <Checkbox
          id="check-deploy-as-project"
          label="Deploy as a project"
          description={"All files in the workspace will be deployed as-is so no pre-built template will be used."}
          isChecked={shouldDeployAsProject}
          onChange={(_event, checked) => setShouldDeployAsProject(checked)}
          isDisabled={!canDeployAsProject}
        />
      </Tooltip>
      <ExpandableSection
        toggleTextCollapsed="Show advanced options"
        toggleTextExpanded="Hide advanced options"
        className={"plain"}
      >
        <Tooltip
          content={"To use this option, you need to configure your Service Account and Service Registry on Settings."}
          trigger={!canUploadOpenApi ? "mouseenter click" : ""}
        >
          <Checkbox
            id="check-use-service-registry"
            label="Upload spec to Service Registry"
            description={
              "The spec associated with the deployment will be available in the configured Service Registry."
            }
            isChecked={shouldUploadOpenApi}
            onChange={(_event, checked) => setShouldUploadOpenApi(checked)}
            isDisabled={!canUploadOpenApi}
          />
        </Tooltip>
      </ExpandableSection>
    </>
  );
};

export const SwfDeployOptions = forwardRef(RefForwardingSwfDeployOptions);
