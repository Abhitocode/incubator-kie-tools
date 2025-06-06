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
import { useEffect, useMemo, useState } from "react";
import { TextInput } from "@patternfly/react-core/dist/js/components/TextInput";
import { Stack, StackItem } from "@patternfly/react-core/dist/js/layouts/Stack";
import { Split, SplitItem } from "@patternfly/react-core/dist/js/layouts/Split";
import { FormGroup } from "@patternfly/react-core/dist/js/components/Form";
import { Select, SelectOption, SelectVariant } from "@patternfly/react-core/deprecated";
import "./OutputFieldRow.scss";
import { DataType, OpType, OutputField, RankOrder, ResultFeature } from "@kie-tools/pmml-editor-marshaller";
import { OutputLabelsEditMode } from "../atoms";

import { ValidatedType } from "../../../types";
import useOnclickOutside from "react-cool-onclickoutside";
import { Operation, useOperation } from "../../EditorScorecard";
import { useValidationRegistry } from "../../../validation";
import { Builder } from "../../../paths";
import { FormHelperText } from "@patternfly/react-core/dist/js/components/Form";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/js/components/HelperText";

interface OutputFieldEditRowProps {
  modelIndex: number;
  outputField: OutputField;
  outputFieldIndex: number;
  validateOutputName: (name: string) => boolean;
  viewExtendedProperties: () => void;
  onCommitAndClose: () => void;
  onCommit: (partial: Partial<OutputField>) => void;
  onCancel: () => void;
}

const dataTypes = [
  "string",
  "integer",
  "float",
  "double",
  "boolean",
  "date",
  "time",
  "dateTime",
  "dateDaysSince[0]",
  "dateDaysSince[1960]",
  "dateDaysSince[1970]",
  "dateDaysSince[1980]",
  "timeSeconds",
  "dateTimeSecondsSince[0]",
  "dateTimeSecondsSince[1960]",
  "dateTimeSecondsSince[1970]",
  "dateTimeSecondsSince[1980]",
];

const OutputFieldEditRow = (props: OutputFieldEditRowProps) => {
  const {
    modelIndex,
    outputField,
    outputFieldIndex,
    validateOutputName,
    viewExtendedProperties,
    onCommitAndClose,
    onCommit,
    onCancel,
  } = props;

  const { activeOperation } = useOperation();

  const [name, setName] = useState<ValidatedType<string>>({ value: "", valid: false });
  const [dataType, setDataType] = useState<DataType>("boolean");
  const [optype, setOptype] = useState<OpType | undefined>();
  const [targetField, setTargetField] = useState<string | undefined>();
  const [feature, setFeature] = useState<ResultFeature | undefined>();
  const [value, setValue] = useState<any | undefined>();
  const [rank, setRank] = useState<number | undefined>();
  const [rankOrder, setRankOrder] = useState<RankOrder | undefined>();
  const [segmentId, setSegmentId] = useState<string | undefined>();
  const [isFinalResult, setIsFinalResult] = useState<boolean | undefined>();

  useEffect(() => {
    if (outputField === undefined) {
      return;
    }
    setName({
      value: outputField.name,
      valid: validateOutputName(outputField.name),
    });
    setDataType(outputField.dataType);
    setOptype(outputField.optype);
    setTargetField(outputField.targetField);
    setFeature(outputField.feature);
    setValue(outputField.value);
    setRank(outputField.rank);
    setRankOrder(outputField.rankOrder);
    setSegmentId(outputField.segmentId);
    setIsFinalResult(outputField.isFinalResult);
  }, [props]);

  const [isTypeSelectOpen, setIsTypeSelectOpen] = useState(false);
  const typeToggle = (isOpen: boolean) => {
    setIsTypeSelectOpen(isOpen);
  };

  const ref = useOnclickOutside(
    () => {
      if (name?.valid) {
        onCommitAndClose();
      } else {
        onCancel();
      }
    },
    {
      disabled: activeOperation !== Operation.UPDATE_OUTPUT,
      eventTypes: ["click"],
    }
  );

  const { validationRegistry } = useValidationRegistry();
  const targetFieldValidation = useMemo(
    () =>
      validationRegistry.get(
        Builder().forModel(modelIndex).forOutput().forOutputField(outputFieldIndex).forTargetField().build()
      ),
    [outputFieldIndex, modelIndex, outputField]
  );
  return (
    <section
      className={"editable-item__inner"}
      ref={ref}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onCancel();
        }
      }}
    >
      <Stack hasGutter={true}>
        <StackItem>
          <Split hasGutter={true}>
            <SplitItem>
              <FormGroup label="Name" fieldId="output-name-helper" isRequired={true}>
                <TextInput
                  type="text"
                  id="output-name"
                  name="output-name"
                  aria-describedby="output-name-helper"
                  value={name?.value?.toString() ?? ""}
                  placeholder="Name"
                  validated={name?.valid ? "default" : "error"}
                  autoFocus={true}
                  onChange={(_event, e) => {
                    setName({
                      value: e,
                      valid: validateOutputName(e),
                    });
                  }}
                  onBlur={(e) => {
                    if (name?.valid) {
                      onCommit({
                        name: name.value,
                      });
                    } else {
                      setName({
                        value: outputField?.name,
                        valid: validateOutputName(outputField.name),
                      });
                    }
                  }}
                  ouiaId="set-output-field-name"
                />
                {name?.valid === true ? (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant="default"></HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                ) : (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem variant="error">Name is mandatory and must be unique</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            </SplitItem>
            <SplitItem isFilled={true}>
              <FormGroup
                label="Data type"
                fieldId="output-dataType-helper"
                style={{ width: "12em" }}
                isRequired={true}
                data-ouia-component-id="select-output-field-type"
              >
                <Select
                  id="output-dataType"
                  name="output-dataType"
                  aria-label="Select Input"
                  aria-describedby="output-dataType-helper"
                  className="ignore-onclickoutside"
                  variant={SelectVariant.single}
                  onToggle={(_event, isOpen: boolean) => typeToggle(isOpen)}
                  onSelect={(event: any, selection: any, isPlaceholder: boolean) => {
                    setIsTypeSelectOpen(false);
                    setDataType(isPlaceholder ? undefined : selection);
                    onCommit({
                      dataType: isPlaceholder ? undefined : selection,
                    });
                  }}
                  selections={dataType}
                  isOpen={isTypeSelectOpen}
                  placeholder="Type"
                  menuAppendTo={"parent"}
                >
                  {dataTypes.map((dt, _index) => (
                    <SelectOption key={_index} value={dt} data-ouia-component-type="select-option" />
                  ))}
                </Select>
              </FormGroup>
            </SplitItem>
          </Split>
        </StackItem>
        <StackItem>
          <Split>
            <SplitItem>
              <FormGroup label="Properties" fieldId="output-labels-helper">
                <OutputLabelsEditMode
                  optype={optype}
                  setOptype={setOptype}
                  targetField={targetField}
                  setTargetField={setTargetField}
                  targetFieldValidation={targetFieldValidation}
                  feature={feature}
                  setFeature={setFeature}
                  value={value}
                  setValue={setValue}
                  rank={rank}
                  setRank={setRank}
                  rankOrder={rankOrder}
                  setRankOrder={setRankOrder}
                  segmentId={segmentId}
                  setSegmentId={setSegmentId}
                  isFinalResult={isFinalResult}
                  setIsFinalResult={setIsFinalResult}
                  viewExtendedProperties={viewExtendedProperties}
                  commit={onCommit}
                  isDisabled={!name?.valid ?? true}
                />
              </FormGroup>
            </SplitItem>
          </Split>
        </StackItem>
      </Stack>
    </section>
  );
};

export default OutputFieldEditRow;
