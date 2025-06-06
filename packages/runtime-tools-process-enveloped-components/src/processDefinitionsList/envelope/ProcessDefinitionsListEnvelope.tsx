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
import * as React from "react";
import * as ReactDOM from "react-dom";
import { EnvelopeBus } from "@kie-tools-core/envelope-bus/dist/api";
import { ProcessDefinitionsListChannelApi, ProcessDefinitionsListEnvelopeApi } from "../api";
import { Envelope, EnvelopeDivConfig } from "@kie-tools-core/envelope";
import { ProcessDefinitionsListEnvelopeContext } from "./ProcessDefinitionsListEnvelopeContext";
import {
  ProcessDefinitionsListEnvelopeView,
  ProcessDefinitionsListEnvelopeViewApi,
} from "./ProcessDefinitionsListEnvelopeView";
import { ProcessDefinitionsListEnvelopeApiImpl } from "./ProcessDefinitionsListEnvelopeApiImpl";

/**
 * Function that starts an Envelope application.
 *
 * @param args.container: The HTML element in which the process list View will render
 * @param args.bus: The implementation of a `bus` that knows how to send messages to the Channel.
 * @param args.config: The config which contains the container type and the envelope id.
 *
 */
export function init(args: { config: EnvelopeDivConfig; container: HTMLDivElement; bus: EnvelopeBus }) {
  /**
   * Creates a new generic Envelope, typed with the right interfaces.
   */
  const envelope = new Envelope<
    ProcessDefinitionsListEnvelopeApi,
    ProcessDefinitionsListChannelApi,
    ProcessDefinitionsListEnvelopeViewApi,
    ProcessDefinitionsListEnvelopeContext
  >(args.bus, args.config);

  const envelopeViewDelegate = async () => {
    const ref = React.createRef<ProcessDefinitionsListEnvelopeViewApi>();
    return new Promise<() => ProcessDefinitionsListEnvelopeViewApi>((res) => {
      ReactDOM.render(
        <ProcessDefinitionsListEnvelopeView ref={ref} channelApi={envelope.channelApi} />,
        args.container,
        () => res(() => ref.current!)
      );
    });
  };

  const context: ProcessDefinitionsListEnvelopeContext = {};
  return envelope.start(envelopeViewDelegate, context, {
    create: (apiFactoryArgs) => new ProcessDefinitionsListEnvelopeApiImpl(apiFactoryArgs),
  });
}
