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

package org.jboss.errai.ioc.rebind.ioc.bootstrapper;


import static org.jboss.errai.codegen.util.Stmt.loadVariable;

import com.google.common.collect.Multimap;
import com.google.gwt.core.ext.GeneratorContext;
import com.google.gwt.core.ext.TreeLogger;
import com.google.gwt.core.ext.typeinfo.JClassType;
import com.google.gwt.core.ext.typeinfo.JConstructor;
import com.google.gwt.core.ext.typeinfo.JPackage;
import com.google.gwt.user.rebind.SourceWriter;
import com.google.gwt.user.rebind.StringSourceWriter;
import org.jboss.errai.bus.server.ErraiBootstrapFailure;
import org.jboss.errai.codegen.AnnotationEncoder;
import org.jboss.errai.codegen.Context;
import org.jboss.errai.codegen.InterningCallback;
import org.jboss.errai.codegen.Modifier;
import org.jboss.errai.codegen.Statement;
import org.jboss.errai.codegen.builder.BlockBuilder;
import org.jboss.errai.codegen.builder.ClassStructureBuilder;
import org.jboss.errai.codegen.builder.impl.BlockBuilderImpl;
import org.jboss.errai.codegen.literal.ArrayLiteral;
import org.jboss.errai.codegen.literal.LiteralFactory;
import org.jboss.errai.codegen.literal.LiteralValue;
import org.jboss.errai.codegen.meta.MetaClass;
import org.jboss.errai.codegen.meta.MetaClassFactory;
import org.jboss.errai.codegen.meta.MetaField;
import org.jboss.errai.codegen.meta.MetaMethod;
import org.jboss.errai.codegen.meta.impl.build.BuildMetaClass;
import org.jboss.errai.codegen.meta.impl.gwt.GWTClass;
import org.jboss.errai.codegen.meta.impl.gwt.GWTUtil;
import org.jboss.errai.codegen.util.Implementations;
import org.jboss.errai.codegen.util.PrivateAccessType;
import org.jboss.errai.codegen.util.PrivateAccessUtil;
import org.jboss.errai.codegen.util.Refs;
import org.jboss.errai.codegen.util.Stmt;
import org.jboss.errai.common.metadata.MetaDataScanner;
import org.jboss.errai.common.metadata.RebindUtils;
import org.jboss.errai.common.metadata.ScannerSingleton;
import org.jboss.errai.config.rebind.EnvUtil;
import org.jboss.errai.config.rebind.ReachableTypes;
import org.jboss.errai.config.util.ClassScanner;
import org.jboss.errai.config.util.ThreadUtil;
import org.jboss.errai.ioc.client.Bootstrapper;
import org.jboss.errai.ioc.client.BootstrapperInjectionContext;
import org.jboss.errai.ioc.client.QualifierUtil;
import org.jboss.errai.ioc.client.api.CodeDecorator;
import org.jboss.errai.ioc.client.api.EntryPoint;
import org.jboss.errai.ioc.client.api.IOCBootstrapTask;
import org.jboss.errai.ioc.client.api.IOCProvider;
import org.jboss.errai.ioc.client.api.TaskOrder;
import org.jboss.errai.ioc.client.api.TestMock;
import org.jboss.errai.ioc.client.container.CreationalContext;
import org.jboss.errai.ioc.rebind.ioc.extension.IOCDecoratorExtension;
import org.jboss.errai.ioc.rebind.ioc.extension.IOCExtensionConfigurator;
import org.jboss.errai.ioc.rebind.ioc.injector.api.InjectionContext;
import org.jboss.errai.ioc.rebind.ioc.injector.api.WiringElementType;
import org.jboss.errai.ioc.rebind.ioc.metadata.QualifyingMetadataFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.enterprise.context.Dependent;
import javax.enterprise.context.NormalScope;
import javax.enterprise.inject.Alternative;
import javax.enterprise.inject.Any;
import javax.enterprise.inject.Default;
import javax.enterprise.inject.Stereotype;
import javax.inject.Inject;
import javax.inject.Scope;
import javax.inject.Singleton;
import java.io.File;
import java.lang.annotation.Annotation;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Generator for the Bootstrapper class generated to wire an application at runtime.
 *
 * @author Mike Brock <cbrock@redhat.com>
 */
public class IOCBootstrapGenerator {
  private final GeneratorContext context;

  private final Set<String> packages;
  private final boolean useReflectionStubs;

  private final List<MetaClass> beforeTasks = new ArrayList<MetaClass>();
  private final List<MetaClass> afterTasks = new ArrayList<MetaClass>();

  public static final String QUALIFYING_METADATA_FACTORY_PROPERTY = "errai.ioc.QualifyingMetaDataFactory";
  public static final String ENABLED_ALTERNATIVES_PROPERTY = "errai.ioc.enabled.alternatives";
  public static final String EXPERIMENTAL_INFER_DEPENDENT_BY_REACHABILITY
      = "errai.ioc.experimental.infer_dependent_by_reachability";

  private final TreeLogger logger;
  private static final Logger log = LoggerFactory.getLogger(IOCBootstrapGenerator.class);

  // production mode cache only -- used so work is only done in one permutation
  private static volatile String _bootstrapperCache;
  private static final Object generatorLock = new Object();

  public IOCBootstrapGenerator(final GeneratorContext context,
                               final TreeLogger logger,
                               final Set<String> packages,
                               final boolean useReflectionStubs) {
    this.context = context;
    this.logger = logger;
    this.packages = packages;
    this.useReflectionStubs = useReflectionStubs;
  }

  public String generate(final String packageName, final String className) {
    synchronized (generatorLock) {
      EnvUtil.recordEnvironmentState();

      if (_bootstrapperCache != null && EnvUtil.isProdMode()) {
        return _bootstrapperCache;
      }

      final File fileCacheDir = RebindUtils.getErraiCacheDir();
      final File cacheFile = new File(fileCacheDir.getAbsolutePath() + "/" + className + ".java");

      final String gen;

      if (context != null) {
        // context == null during some tests, in which case we don't have a GWT type oracle
        GWTUtil.populateMetaClassFactoryFromTypeOracle(context, logger);
      }

      log.info("generating IOC bootstrapping class...");
      final long st = System.currentTimeMillis();
      gen = _generate(packageName, className);
      log.info("generated IOC bootstrapping class in " + (System.currentTimeMillis() - st) + "ms "
          + "(" + MetaClassFactory.getAllCachedClasses().size() + " beans processed)");

      ThreadUtil.execute(new Runnable() {
        @Override
        public void run() {
          RebindUtils.writeStringToFile(cacheFile, gen);
        }
      });

      log.info("using IOC bootstrapping code at: " + cacheFile.getAbsolutePath());

      return _bootstrapperCache = gen;
    }
  }

  private String _generate(final String packageName, final String className) {
    final ReachableTypes allDeps = EnvUtil.getAllReachableClasses(context);

    final ClassStructureBuilder<?> classStructureBuilder =
        Implementations.implement(Bootstrapper.class, packageName, className);

    logger.log(com.google.gwt.core.ext.TreeLogger.Type.DEBUG, "Generating IOC Bootstrapper "
        + packageName + "." + className);

    final BuildMetaClass bootStrapClass = classStructureBuilder.getClassDefinition();
    final Context buildContext = bootStrapClass.getContext();

    final MetaClass Annotation_MC = MetaClassFactory.get(Annotation.class);

    buildContext.addInterningCallback(new InterningCallback() {
      private final Map<Set<Annotation>, String> cachedArrays = new HashMap<Set<Annotation>, String>();

      @Override
      public Statement intern(final LiteralValue<?> literalValue) {
        if (literalValue.getValue() == null) {
          return null;
        }

        if (literalValue.getValue() instanceof Annotation) {
          final Annotation annotation = (Annotation) literalValue.getValue();

          if (annotation.annotationType().equals(Default.class)) {
            return Stmt.loadStatic(QualifierUtil.class, "DEFAULT_ANNOTATION");
          }
          else if (annotation.annotationType().equals(Any.class)) {
            return Stmt.loadStatic(QualifierUtil.class, "ANY_ANNOTATION");
          }

          final Class<? extends Annotation> aClass = annotation.annotationType();
          final String fieldName = PrivateAccessUtil.condensify(aClass.getPackage().getName()) +
              aClass.getSimpleName() + "_" + String.valueOf(literalValue.getValue().hashCode()).replaceFirst("\\-", "_");

          classStructureBuilder.privateField(fieldName, annotation.annotationType())
              .modifiers(Modifier.Final).initializesWith(AnnotationEncoder.encode(annotation))
              .finish();

          return Refs.get(fieldName);
        }
        else if (literalValue.getType().isArray()
            && Annotation_MC.isAssignableFrom(literalValue.getType().getOuterComponentType())) {

          final Set<Annotation> annotationSet
              = new HashSet<Annotation>(Arrays.asList((Annotation[]) literalValue.getValue()));

          if (QualifierUtil.isDefaultAnnotations(annotationSet)) {
            return Stmt.loadStatic(QualifierUtil.class, "DEFAULT_QUALIFIERS");
          }

          if (cachedArrays.containsKey(annotationSet)) {
            return Refs.get(cachedArrays.get(annotationSet));
          }

          final MetaClass type = literalValue.getType().getOuterComponentType();
          final String fieldName = "arrayOf" + PrivateAccessUtil.condensify(type.getPackageName()) +
              type.getName().replaceAll("\\.", "_") + "_"
              + String.valueOf(literalValue.getValue().hashCode()).replaceAll("\\-", "_");

          // force rendering of literals in this array first.
          for (final Annotation a : annotationSet) {
            LiteralFactory.getLiteral(a).generate(buildContext);
          }

          classStructureBuilder.privateField(fieldName, literalValue.getType())
              .modifiers(Modifier.Final).initializesWith(new Statement() {
            @Override
            public String generate(final Context context) {
              return new ArrayLiteral(literalValue.getValue()).getCanonicalString(context);
            }

            @Override
            public MetaClass getType() {
              return literalValue.getType();
            }
          }).finish();

          cachedArrays.put(annotationSet, fieldName);

          return Refs.get(fieldName);
        }

        return null;
      }
    });

    final BlockBuilder<?> blockBuilder =
        classStructureBuilder.publicMethod(BootstrapperInjectionContext.class, "bootstrapContainer")
            .methodComment("The main IOC bootstrap method.");

    final SourceWriter sourceWriter = new StringSourceWriter();

    final IOCProcessingContext.Builder iocProcContextBuilder
        = IOCProcessingContext.Builder.create();

    iocProcContextBuilder.blockBuilder(blockBuilder);
    iocProcContextBuilder.generatorContext(context);
    iocProcContextBuilder.context(buildContext);
    iocProcContextBuilder.bootstrapClassInstance(bootStrapClass);
    iocProcContextBuilder.bootstrapBuilder(classStructureBuilder);
    iocProcContextBuilder.logger(logger);
    iocProcContextBuilder.sourceWriter(sourceWriter);
    iocProcContextBuilder.gwtTarget(!useReflectionStubs);

    final InjectionContext.Builder injectionContextBuilder
        = InjectionContext.Builder.create();

    final MetaDataScanner scanner = ScannerSingleton.getOrCreateInstance();
    final Multimap<String, String> props = scanner.getErraiProperties();

    if (props != null) {
      logger.log(TreeLogger.Type.INFO, "Checking ErraiApp.properties for configured types ...");

      final Collection<String> qualifyingMetadataFactoryProperties = props.get(QUALIFYING_METADATA_FACTORY_PROPERTY);

      if (qualifyingMetadataFactoryProperties.size() > 1) {
        throw new RuntimeException("the property '" + QUALIFYING_METADATA_FACTORY_PROPERTY + "' is set in more than one place");
      }
      else if (qualifyingMetadataFactoryProperties.size() == 1) {
        final String fqcnQualifyingMetadataFactory = qualifyingMetadataFactoryProperties.iterator().next().trim();

        try {
          final QualifyingMetadataFactory factory = (QualifyingMetadataFactory)
              Class.forName
                  (fqcnQualifyingMetadataFactory).newInstance();

          iocProcContextBuilder.qualifyingMetadata(factory);
        }
        catch (ClassNotFoundException e) {
          e.printStackTrace();
        }
        catch (InstantiationException e) {
          e.printStackTrace();
        }
        catch (IllegalAccessException e) {
          e.printStackTrace();
        }
      }

      final Collection<String> enabledAlternativesProperties = props.get(ENABLED_ALTERNATIVES_PROPERTY);

      for (final String prop : enabledAlternativesProperties) {
          final String[] alternatives = prop.split("\\s");
          for (final String alternative : alternatives) {
            injectionContextBuilder.enabledAlternative(alternative.trim());
          }
      }
    }

    iocProcContextBuilder.packages(packages);

    final IOCProcessingContext procContext = iocProcContextBuilder.build();

    injectionContextBuilder.processingContext(procContext);
    injectionContextBuilder.reachableTypes(allDeps);
    final InjectionContext injectionContext = injectionContextBuilder.build();

    defaultConfigureProcessor(injectionContext);

    // generator constructor source code
    final IOCProcessorFactory procFactory = new IOCProcessorFactory(injectionContext);
    processExtensions(context, procContext, injectionContext, procFactory, beforeTasks, afterTasks);
    generateExtensions(procContext, procFactory, injectionContext, sourceWriter, classStructureBuilder, blockBuilder);

    // close generated class
    return sourceWriter.toString();
  }

  private void generateExtensions(final IOCProcessingContext procContext,
                                  final IOCProcessorFactory procFactory,
                                  final InjectionContext injectionContext,
                                  final SourceWriter sourceWriter,
                                  final ClassStructureBuilder<?> classBuilder,
                                  final BlockBuilder<?> blockBuilder) {


    classBuilder.privateField(procContext.getContextVariableReference().getName(), procContext.getContextVariableReference().getType())
        .modifiers(Modifier.Final).initializesWith(Stmt.newObject(BootstrapperInjectionContext.class)).finish();

    classBuilder.privateField("context", CreationalContext.class).modifiers(Modifier.Final)
        .initializesWith(Stmt.loadVariable(procContext.getContextVariableReference().getName())
            .invoke("getRootContext")).finish();

    @SuppressWarnings("unchecked")
    final BlockBuilder builder = new BlockBuilderImpl(classBuilder.getClassDefinition().getInstanceInitializer(), null);

    _doRunnableTasks(beforeTasks, builder);

    procFactory.process(procContext);

    int i = 0;
    int beanDeclareMethodCount = 0;
    BlockBuilder<? extends ClassStructureBuilder<?>> declareBeanBody = null;

    for (final Statement stmt : procContext.getAppendToEnd()) {
      if (declareBeanBody == null || (i % 500) == 0) {
        if (declareBeanBody != null) {
          declareBeanBody.finish();
        }
        final String methodName = "declareBeans_" + beanDeclareMethodCount++;

        declareBeanBody = classBuilder.privateMethod(void.class, methodName).body();
        blockBuilder.append(Stmt.loadVariable("this").invoke(methodName));
      }

      declareBeanBody.append(stmt);

      i++;
    }

    if (declareBeanBody != null) {
      declareBeanBody.finish();
    }

    final Map<MetaField, PrivateAccessType> privateFields = injectionContext.getPrivateFieldsToExpose();
    for (final Map.Entry<MetaField, PrivateAccessType> f : privateFields.entrySet()) {
      PrivateAccessUtil.addPrivateAccessStubs(f.getValue(),
          !useReflectionStubs ? "jsni" : "reflection", classBuilder, f.getKey());
    }

    final Collection<MetaMethod> privateMethods = injectionContext.getPrivateMethodsToExpose();

    for (final MetaMethod m : privateMethods) {
      PrivateAccessUtil.addPrivateAccessStubs(!useReflectionStubs ? "jsni" : "reflection", classBuilder, m);
    }

    _doRunnableTasks(afterTasks, blockBuilder);

    blockBuilder.append(loadVariable(procContext.getContextVariableReference()).returnValue());

    blockBuilder.finish();

    sourceWriter.print(classBuilder.toJavaString());
  }

  private static void _doRunnableTasks(final Collection<MetaClass> classes, final BlockBuilder<?> blockBuilder) {
    for (final MetaClass clazz : classes) {
      if (!clazz.isAssignableTo(Runnable.class)) {
        throw new RuntimeException("annotated @IOCBootstrap task: " + clazz.getName() + " is not of type: "
            + Runnable.class.getName());
      }

      blockBuilder.append(Stmt.nestedCall(Stmt.newObject(clazz)).invoke("run"));
    }
  }

  public static void processExtensions(final GeneratorContext context,
                                       final IOCProcessingContext processingContext,
                                       final InjectionContext injectionContext,
                                       final IOCProcessorFactory processorFactory,
                                       final List<MetaClass> beforeTasks,
                                       final List<MetaClass> afterTasks) {

    final MetaDataScanner scanner = ScannerSingleton.getOrCreateInstance();

    /*
    * IOCDecoratorExtension.class
    */
    final Set<Class<?>> iocExtensions = scanner
        .getTypesAnnotatedWith(org.jboss.errai.ioc.client.api.IOCExtension.class);
    final List<IOCExtensionConfigurator> extensionConfigurators = new ArrayList<IOCExtensionConfigurator>();

    for (final Class<?> clazz : iocExtensions) {
      try {
        final Class<? extends IOCExtensionConfigurator> configuratorClass
            = clazz.asSubclass(IOCExtensionConfigurator.class);

        final IOCExtensionConfigurator configurator = configuratorClass.newInstance();
        configurator.configure(processingContext, injectionContext, processorFactory);

        extensionConfigurators.add(configurator);
      }
      catch (Exception e) {
        throw new ErraiBootstrapFailure("unable to load IOC Extension Configurator: " + e.getMessage(), e);
      }
    }

    computeDependentScope(context, injectionContext);

    final Collection<MetaClass> bootstrapClassCollection = ClassScanner.getTypesAnnotatedWith(IOCBootstrapTask.class);
    for (final MetaClass clazz : bootstrapClassCollection) {
      final IOCBootstrapTask task = clazz.getAnnotation(IOCBootstrapTask.class);
      if (task.value() == TaskOrder.Before) {
        beforeTasks.add(clazz);
      }
      else {
        afterTasks.add(clazz);
      }
    }

    /**
     * CodeDecorator.class
     */
    final Set<Class<?>> decorators = scanner.getTypesAnnotatedWith(CodeDecorator.class);
    for (final Class<?> clazz : decorators) {
      try {
        final Class<? extends IOCDecoratorExtension> decoratorClass = clazz.asSubclass(IOCDecoratorExtension.class);

        Class<? extends Annotation> annoType = null;
        final Type t = decoratorClass.getGenericSuperclass();
        if (!(t instanceof ParameterizedType)) {
          throw new ErraiBootstrapFailure("code decorator must extend IOCDecoratorExtension<@AnnotationType>");
        }

        final ParameterizedType pType = (ParameterizedType) t;
        if (IOCDecoratorExtension.class.equals(pType.getRawType())) {
          if (pType.getActualTypeArguments().length == 0
              || !Annotation.class.isAssignableFrom((Class) pType.getActualTypeArguments()[0])) {
            throw new ErraiBootstrapFailure("code decorator must extend IOCDecoratorExtension<@AnnotationType>");
          }

          // noinspection unchecked
          annoType = ((Class) pType.getActualTypeArguments()[0]).asSubclass(Annotation.class);
        }

        injectionContext.registerDecorator(
            decoratorClass.getConstructor(new Class[]{Class.class}).newInstance(annoType)
        );
      }
      catch (Exception e) {
        throw new ErraiBootstrapFailure("unable to load code decorator: " + e.getMessage(), e);
      }
    }

    for (final IOCExtensionConfigurator extensionConfigurator : extensionConfigurators) {
      extensionConfigurator.afterInitialization(processingContext, injectionContext, processorFactory);
    }
  }

  /**
   * @param injectionContext
   *     an instance of the injection context
   */
  private static void defaultConfigureProcessor(final InjectionContext injectionContext) {
    injectionContext.mapElementType(WiringElementType.SingletonBean, Singleton.class);
    injectionContext.mapElementType(WiringElementType.SingletonBean, EntryPoint.class);

    injectionContext.mapElementType(WiringElementType.DependentBean, Dependent.class);

    for (final MetaClass mc : ClassScanner.getTypesAnnotatedWith(Stereotype.class)) {
      processStereoType(injectionContext, mc.asClass().asSubclass(Annotation.class));
    }

    injectionContext.mapElementType(WiringElementType.TopLevelProvider, IOCProvider.class);

    injectionContext.mapElementType(WiringElementType.InjectionPoint, Inject.class);
    injectionContext.mapElementType(WiringElementType.InjectionPoint, com.google.inject.Inject.class);

    injectionContext.mapElementType(WiringElementType.AlternativeBean, Alternative.class);
    injectionContext.mapElementType(WiringElementType.TestMockBean, TestMock.class);
  }

  private static boolean processStereoType(final InjectionContext injectionContext,
                                           final Class<? extends Annotation> anno) {
    boolean defaultScope = true;

    for (final Annotation a : anno.getAnnotations()) {
      if (a.annotationType().isAnnotationPresent(Stereotype.class)) {
        defaultScope = processStereoType(injectionContext, a.annotationType());
      }
      if (injectionContext.isElementType(WiringElementType.SingletonBean, a.annotationType())
          || injectionContext.isElementType(WiringElementType.DependentBean, a.annotationType())) {
        defaultScope = false;
      }
    }

    if (defaultScope) {
      injectionContext.mapElementType(WiringElementType.DependentBean, anno);
    }

    return defaultScope;
  }

  private static void computeDependentScope(final GeneratorContext context, final InjectionContext injectionContext) {

    if (context != null) {
      for (final JPackage pkg : context.getTypeOracle().getPackages()) {
        TypeScan:
        for (final JClassType type : pkg.getTypes()) {
          if (!type.isDefaultInstantiable()) {
            boolean hasInjectableConstructor = false;
            for (final JConstructor c : type.getConstructors()) {
              if (injectionContext.isElementType(WiringElementType.InjectionPoint, c)) {
                hasInjectableConstructor = true;
                break;
              }
            }

            if (!hasInjectableConstructor) {
              continue;
            }
          }

          for (final Annotation a : type.getAnnotations()) {
            final Class<? extends Annotation> annoClass = a.annotationType();
            if (annoClass.isAnnotationPresent(Scope.class)
                || annoClass.isAnnotationPresent(NormalScope.class)) {
              continue TypeScan;
            }
          }

          injectionContext.addPsuedoScopeForType(GWTClass.newInstance(type.getOracle(), type));
        }
      }
    }
  }
}