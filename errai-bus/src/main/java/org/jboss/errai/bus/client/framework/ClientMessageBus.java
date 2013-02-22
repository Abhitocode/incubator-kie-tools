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

package org.jboss.errai.bus.client.framework;

import org.jboss.errai.bus.client.api.BusLifecycleListener;
import org.jboss.errai.bus.client.api.PreInitializationListener;

import java.util.Set;

/**
 * An extended client-specific/in-browser interface of {@link MessageBus}, which defines client-specific functionalities.
 *
 * @author Mike Brock
 */
public interface ClientMessageBus extends MessageBus {
  public static final String REMOTE_QUEUE_ID_HEADER = "RemoteQueueID";

//  /**
//   * Add a {@link Runnable} initialization task to be executed after the bus has successfully finished it's
//   * initialization and is now communicating with the remote bus.
//   *
//   * @param run a {@link Runnable} task.
//   */
//  public void addPostInitTask(Runnable run);

  /**
   * Adds the given listener instance to this bus. The listener will be notified
   * each time the bus transitions to a different lifecycle state.
   *
   * @param l
   *          The listener that wants to receive lifecycle notifications. Must
   *          not be null. If the same listener is added more than once, it will
   *          receive the corresponding number of callbacks upon each lifecycle
   *          event.
   */
  public void addLifecycleListener(BusLifecycleListener l);

  /**
   * Removes the given listener from this bus. The listener will no longer
   * receive lifecycle events from this bus.
   *
   * @param l
   *          The listener to remove. If the listener was added more than one
   *          time, removing it will decrease by one the number of notifications
   *          that listener receices for each event. If the listener was not
   *          already registered to receive events, this method has no effect.
   */
  public void removeLifecycleListener(BusLifecycleListener l);

  /**
   * Takes this bus out of the "local only" state, causing it to try and connect
   * with the server (unless remote communication is globally disabled).
   *
   * @see ClientMessageBusImpl#isRemoteCommunicationEnabled()
   */
  public void init();

  /**
   * Takes this bus into the "local only" state.
   *
   * @param sendDisconnectToServer
   *          if true, the server will be notified that we are breaking the
   *          connection. Else, no attempt will be made to notify the server.
   */
  public void stop(boolean sendDisconnectToServer);

  public Set<String> getAllRegisteredSubjects();

  /**
   * Adds a global transport error handler to deal with any errors which arise
   * from communication between the bus and the server
   *
   * @param errorHandler
   *          the error handler to add.
   */
  public void addTransportErrorHandler(TransportErrorHandler errorHandler);


  /**
   * When called, the MessageBus assumes that the currently active transport is no longer capable of operating. The
   * MessageBus then find the best remaining handler and activates it.
   */
  void reconsiderTransport();
}
