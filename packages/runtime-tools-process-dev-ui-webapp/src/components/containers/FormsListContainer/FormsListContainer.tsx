/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDevUIAppContext } from "../../contexts/DevUIAppContext";
import { FormInfo } from "@kie-tools/runtime-tools-shared-gateway-api/dist/types";
import { EmbeddedFormsList } from "@kie-tools/runtime-tools-process-enveloped-components/dist/formsList";
import { useFormsListChannelApi } from "../../../channel/FormsList";

const FormsListContainer: React.FC = () => {
  const navigate = useNavigate();
  const channelApi = useFormsListChannelApi();
  const appContext = useDevUIAppContext();

  useEffect(() => {
    const unsubscriber = channelApi.formsList__onOpenFormListen({
      onOpen(formData: FormInfo) {
        navigate(
          {
            pathname: `../Forms/${formData.name}`,
          },
          {
            state: {
              filter: channelApi.formsList__getFormFilter(),
              formData: formData,
            },
          }
        );
      },
    });
    return () => {
      unsubscriber.then((unsubscribeHandler) => unsubscribeHandler.unSubscribe());
    };
  }, [channelApi, navigate]);

  return <EmbeddedFormsList channelApi={channelApi} targetOrigin={appContext.getDevUIUrl()} />;
};

export default FormsListContainer;
