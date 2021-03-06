import { ExtensionContext, window, workspace } from 'vscode';

import { CargoManager, CommandInvocationReason } from './components/cargo/cargo_manager';

import { RlsConfiguration } from './components/configuration/configuration_manager';

import { ConfigurationManager } from './components/configuration/configuration_manager';

import CurrentWorkingDirectoryManager from './components/configuration/current_working_directory_manager';

import { Manager as LanguageClientManager } from './components/language_client/manager';

import LoggingManager from './components/logging/logging_manager';

import RootLogger from './components/logging/root_logger';

import LegacyModeManager from './legacy_mode_manager';

export async function activate(ctx: ExtensionContext): Promise<void> {
    const loggingManager = new LoggingManager();

    const logger = loggingManager.getLogger();

    const configurationManager = await ConfigurationManager.create();

    const currentWorkingDirectoryManager = new CurrentWorkingDirectoryManager();

    const cargoManager = new CargoManager(
        ctx,
        configurationManager,
        currentWorkingDirectoryManager,
        logger.createChildLogger('Cargo Manager: ')
    );

    chooseModeAndRun(ctx, logger, configurationManager, currentWorkingDirectoryManager);

    addExecutingActionOnSave(ctx, configurationManager, cargoManager);
}

function chooseModeAndRun(
    context: ExtensionContext,
    logger: RootLogger,
    configurationManager: ConfigurationManager,
    currentWorkingDirectoryManager: CurrentWorkingDirectoryManager
): void {
    const rlsConfiguration: RlsConfiguration | undefined = configurationManager.getRlsConfiguration();

    if (rlsConfiguration !== undefined) {
        let { executable, args, env, revealOutputChannelOn } = rlsConfiguration;

        if (!env) {
            env = {};
        }

        if (!env.RUST_SRC_PATH) {
            env.RUST_SRC_PATH = configurationManager.getRustSourcePath();
        }

        const languageClientManager = new LanguageClientManager(
            context,
            logger.createChildLogger('Language Client Manager: '),
            executable,
            args,
            env,
            revealOutputChannelOn
        );

        languageClientManager.initialStart();
    } else {
        const legacyModeManager = new LegacyModeManager(
            context,
            configurationManager,
            currentWorkingDirectoryManager,
            logger.createChildLogger('Legacy Mode Manager: ')
        );

        legacyModeManager.start();
    }
}

function addExecutingActionOnSave(
    context: ExtensionContext,
    configurationManager: ConfigurationManager,
    cargoManager: CargoManager
): void {
    context.subscriptions.push(workspace.onDidSaveTextDocument(document => {
        if (!window.activeTextEditor) {
            return;
        }

        const activeDocument = window.activeTextEditor.document;

        if (document !== activeDocument) {
            return;
        }

        if (document.languageId !== 'rust' || !document.fileName.endsWith('.rs')) {
            return;
        }

        const actionOnSave = configurationManager.getActionOnSave();

        if (!actionOnSave) {
            return;
        }

        switch (actionOnSave) {
            case 'build':
                cargoManager.executeBuildTask(CommandInvocationReason.ActionOnSave);
                break;

            case 'check':
                cargoManager.executeCheckTask(CommandInvocationReason.ActionOnSave);
                break;

            case 'clippy':
                cargoManager.executeClippyTask(CommandInvocationReason.ActionOnSave);
                break;

            case 'doc':
                cargoManager.executeDocTask(CommandInvocationReason.ActionOnSave);
                break;

            case 'run':
                cargoManager.executeRunTask(CommandInvocationReason.ActionOnSave);
                break;

            case 'test':
                cargoManager.executeTestTask(CommandInvocationReason.ActionOnSave);
                break;
        }
    }));
}
