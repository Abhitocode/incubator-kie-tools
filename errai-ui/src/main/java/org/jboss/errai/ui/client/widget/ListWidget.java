/*
 * Copyright 2011 JBoss, by Red Hat, Inc
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

package org.jboss.errai.ui.client.widget;

import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;

import org.jboss.errai.common.client.api.Assert;
import org.jboss.errai.ioc.client.container.IOC;
import org.jboss.errai.ioc.client.container.SyncToAsyncBeanManagerAdpater;
import org.jboss.errai.ioc.client.container.async.AsyncBeanDef;
import org.jboss.errai.ioc.client.container.async.AsyncBeanManager;
import org.jboss.errai.ioc.client.container.async.CreationalCallback;

import com.google.gwt.user.client.ui.ComplexPanel;
import com.google.gwt.user.client.ui.Composite;
import com.google.gwt.user.client.ui.IsWidget;
import com.google.gwt.user.client.ui.VerticalPanel;
import com.google.gwt.user.client.ui.Widget;

/**
 * A type of widget that displays and manages a child widget for each item in a list of model objects. The widget
 * instances are managed by Errai's IOC container and are arranged in a {@link ComplexPanel}. By default a
 * {@link VerticalPanel} is used, but an alternative can be specified using {@link #ListWidget(ComplexPanel)}.
 *
 * @param <M>
 *     the model type
 * @param <W>
 *     the item widget type, needs to implement {@link HasModel} for associating the widget instance with the
 *     corresponding model instance.
 *
 * @author Christian Sadilek <csadilek@redhat.com>
 */
public abstract class ListWidget<M, W extends HasModel<M> & IsWidget> extends Composite {

  private final ComplexPanel panel;
  
  private final AsyncBeanManager bm = IOC.getAsyncBeanManager();
  private final List<WidgetCreationalCallback> creationalCallbackList = new LinkedList<WidgetCreationalCallback>();

  protected ListWidget() {
    this(new VerticalPanel());
  }

  protected ListWidget(ComplexPanel panel) {
    this.panel = Assert.notNull(panel);
    initWidget(panel);
  }

  /**
   * Returns the class object for the item widget type <W> to look up new instances of the widget using the client-side
   * bean manager.
   *
   * @return the item widget type.
   */
  protected abstract Class<W> getItemWidgetType();

  /**
   * Returns the panel that contains all item widgets.
   *
   * @return the item widget panel, never null.
   */
  protected ComplexPanel getPanel() {
    return panel;
  }

  /**
   * Sets the list of model objects. A widget instance of type <W> will be added to the panel for each object in the
   * list.
   *
   * @param items
   *     The list of model objects. If null or empty all existing child widgets will be removed.
   */
  public void setItems(List<M> items) {
    // In the case that this method is executed before the first call has successfully processed all of its
    // callbacks, we must cancel those uncompleted callbacks in flight to prevent duplicate data in the ListWidget.
    for (WidgetCreationalCallback callback : creationalCallbackList) {
      callback.discard();
    }
    creationalCallbackList.clear();

    // clean up the old widgets before we add new ones (this will eventually become a feature of the framework:
    // ERRAI-375)
    Iterator<Widget> it = panel.iterator();
    while (it.hasNext()) {
      bm.destroyBean(it.next());
      it.remove();
    }

    if (items == null)
      return;
    
    AsyncBeanDef<W> itemBeanDef = bm.lookupBean(getItemWidgetType());
    for (final M item : items) {
      final WidgetCreationalCallback callback = new WidgetCreationalCallback(item);
      creationalCallbackList.add(callback);
      itemBeanDef.newInstance(callback);
    }
  }

  /**
   * Returns the widget at the specified index.
   *
   * @param index
   *     the index to be retrieved
   *
   * @return the widget at the specified index
   *
   * @throws IndexOutOfBoundsException
   *     if the index is out of range
   */
  @SuppressWarnings("unchecked")
  public W getWidget(int index) {
    return (W) panel.getWidget(index);
  }

  /**
   * A callback invoked by the {@link AsyncBeanManager} or {@link SyncToAsyncBeanManagerAdpater} when the widget
   * instance was created. It will associate the corresponding model instance with the widget and add the widget to the
   * panel.
   */
  private class WidgetCreationalCallback implements CreationalCallback<W> {
    private boolean discard;
    private final M item;

    private WidgetCreationalCallback(M item) {
      this.item = item;
    }

    @Override
    public void callback(W widget) {
      if (!discard) {
        widget.setModel(item);
        panel.add((Widget) widget);
      }
    }

    public void discard() {
      this.discard = true;
    }
  }
}