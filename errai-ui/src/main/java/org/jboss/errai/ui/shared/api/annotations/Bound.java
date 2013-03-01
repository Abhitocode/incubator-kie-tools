/*
 * Copyright 2012 JBoss, by Red Hat, Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.jboss.errai.ui.shared.api.annotations;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.jboss.errai.databinding.client.api.Converter;
import org.jboss.errai.databinding.client.api.DataBinder;

import com.google.gwt.user.client.ui.Composite;

/**
 * This annotation may only be used in subclasses of {@link Composite} that have been annotated with
 * {@link Templated}, or in a super-class of said {@link Composite} types.
 * <p>
 * It indicates that a {@link DataField} should automatically be bound to a property of a data model
 * associated with a {@link DataBinder} (see {@link AutoBound}).
 * <p>
 * If no property is specified, the {@link DataField} is bound to the data model property with the
 * same name as the field which is the target of this annotation.
 * 
 * @author Christian Sadilek <csadilek@redhat.com>
 */
@Documented
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@SuppressWarnings("rawtypes")
public @interface Bound {

  /**
   * The name of the data model property (or a property chain) to bind the {@link DataField} to,
   * following Java bean conventions. If omitted, the widget will be bound to the data model
   * property with the same name as the field which is the target of this annotation.
   */
  String property() default "";

  /**
   * The {@link Converter} to use when setting values on the model or widget.
   */
  // The NO_CONVERTER class needs to be fully qualified here to work around a JDK bug:
  // http://bugs.sun.com/view_bug.do?bug_id=6512707
  Class<? extends Converter> converter() default org.jboss.errai.ui.shared.api.annotations.Bound.NO_CONVERTER.class;

  static abstract class NO_CONVERTER implements Converter {}
}
