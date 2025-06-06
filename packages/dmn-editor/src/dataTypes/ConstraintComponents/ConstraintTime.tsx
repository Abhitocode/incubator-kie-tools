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
import { useCallback, useMemo, useRef, useState } from "react";
import { TimePicker } from "@patternfly/react-core/dist/js/components/TimePicker";
import "./Constraint.css";
import "./ConstraintTime.css";
import { ConstraintProps } from "./Constraint";
import { Select, SelectOption, SelectVariant } from "@patternfly/react-core/deprecated";
import { useDmnEditor } from "../../DmnEditorContext";
import { useInViewSelect } from "../../responsiveness/useInViewSelect";
import { Tooltip } from "@patternfly/react-core/dist/js/components/Tooltip";
import moment from "moment";

// Time zone list from https://www.timeanddate.com/time/zones/
const UTC_POSITEVE_TIMEZONES = [
  "+00:00",
  "+01:00",
  "+02:00",
  "+03:00",
  "+03:30",
  "+04:00",
  "+04:30",
  "+05:00",
  "+05:30",
  "+05:45",
  "+06:00",
  "+06:30",
  "+07:00",
  "+08:00",
  "+08:30",
  "+08:45",
  "+09:00",
  "+09:30",
  "+10:00",
  "+10:30",
  "+11:00",
  "+12:00",
  "+12:45",
  "+13:00",
  "+13:45",
  "+14:00",
];

const UTC_NEGATIVE_TIMEZONES = [
  "-12:00",
  "-11:00",
  "-10:00",
  "-09:30",
  "-09:00",
  "-08:00",
  "-07:00",
  "-06:00",
  "-05:00",
  "-04:00",
  "-03:30",
  "-03:00",
  "-02:30",
  "-02:00",
  "-01:00",
];

const TIME_REGEXP = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?([+|-](0[0-9]|1[0-9]|2[0-3]):[0-9][0-9])?$/;

export function ConstraintTime({ value, onChange, isValid }: ConstraintProps) {
  const time = useMemo(() => {
    if (value.match(TIME_REGEXP) === null) {
      return "";
    }
    return value.includes("+") ? value.split("+")[0] : value.split("-")[0];
  }, [value]);
  const timezone = useMemo<string>(() => {
    if (value.match(TIME_REGEXP) === null) {
      return UTC_POSITEVE_TIMEZONES[0];
    }
    return value.includes("+")
      ? `+${value.split("+")[1]}`
      : value.includes("-")
        ? `-${value.split("-")[1]}`
        : UTC_POSITEVE_TIMEZONES[0];
  }, [value]);
  const [isSelectTimezoneOpen, setSelectTimezoneOpen] = useState(false);
  const { dmnEditorRootElementRef } = useDmnEditor();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inViewTimezoneSelect = useInViewSelect(dmnEditorRootElementRef, toggleRef);

  const onInternalChange = useCallback(
    (args: { time?: string; timezone?: string }) => {
      const newTime = args.time ?? time;
      const newTimezone = args.timezone ?? timezone;
      if (newTime !== "" && newTimezone !== "") {
        onChange(`${newTime}${newTimezone}`);
      }
    },
    [onChange, time, timezone]
  );

  const onChangeTime = useCallback(
    (value: string) => {
      onInternalChange({ time: value });
    },
    [onInternalChange]
  );

  const onSelectTimezone = useCallback(
    (e, value) => {
      onInternalChange({ timezone: value.toString() });
    },
    [onInternalChange]
  );

  return (
    <div>
      <TimePicker
        is24Hour={true}
        className={`kie-dmn-editor--constraint-time kie-dmn-editor--constraint-input ${
          isValid ? "" : "kie-dmn-editor--constraint-invalid"
        }`}
        inputProps={{
          className: "kie-dmn-editor--constraint-input",
          onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
            if (moment(value, "HH:mm", true).isValid() || moment(value, "HH:mm:ss", true).isValid()) {
              onChangeTime(value);
            }
          },
        }}
        time={time}
        onChange={(e, value) => {
          if (moment(value, "HH:mm", true).isValid()) {
            onChangeTime(`${value}:00`);
          }
          if (moment(value, "HH:mm:ss", true).isValid()) {
            onChangeTime(value);
          }
        }}
        includeSeconds={true}
      />
      {time === "" ? (
        <Tooltip content={"To tweak the timezone it's necessary to set a time first"}>
          <Select
            className={"kie-dmn-editor--constraint-time-timezone"}
            variant={SelectVariant.single}
            onToggle={() => {}}
            selections={UTC_POSITEVE_TIMEZONES[0]}
            isOpen={false}
            isDisabled={true}
            isPlain={true}
          >
            {[<SelectOption key={UTC_POSITEVE_TIMEZONES[0]} value={UTC_POSITEVE_TIMEZONES[0]} />]}
          </Select>
        </Tooltip>
      ) : (
        <Select
          toggleRef={toggleRef}
          className={`kie-dmn-editor--constraint-time-timezone ${
            isValid ? "" : "kie-dmn-editor--constraint-time-timezone-invalid"
          }`}
          variant={SelectVariant.single}
          placeholderText="Select timezone"
          aria-label="Select timezone"
          onToggle={(_event, isExpanded) => setSelectTimezoneOpen(isExpanded)}
          onSelect={onSelectTimezone}
          selections={timezone}
          isOpen={isSelectTimezoneOpen}
          isDisabled={false}
          isPlain={true}
          maxHeight={inViewTimezoneSelect.maxHeight}
          direction={inViewTimezoneSelect.direction}
        >
          {[...UTC_NEGATIVE_TIMEZONES, ...UTC_POSITEVE_TIMEZONES].map((timezone) => (
            <SelectOption key={timezone} value={timezone} />
          ))}
        </Select>
      )}
    </div>
  );
}
