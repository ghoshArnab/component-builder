'use strict';

// Do this as the first thing so that any code reading it knows the right env.
let Env = 'production';
if (process.argv.includes('--development')) {
  Env = 'development';
}
// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = Env;
process.env.NODE_ENV = Env;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', (err) => {
  throw err;
});
const path = require('path');
const chalk = require('react-dev-utils/chalk');
const fs = require('fs-extra');
const webpack = require('webpack');
const configFactory = require('./webpack.config');
const paths = require('./paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');

const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appIndexJs])) {
  process.exit(1);
}

const buildComponent = ({ inputFile, outputFile, componentName }) => {
  // Generate configuration
  const config = configFactory(Env, { inputFile, outputFile, componentName });

  measureFileSizesBeforeBuild(paths.appBuild)
    .then((previousFileSizes) => {
      // Remove all content but keep the directory so that
      // if you're in it, you don't end up in Trash
      fs.emptyDirSync(paths.appBuild);
      // Start the webpack build
      return build(config, previousFileSizes);
    })
    .then(
      ({ stats, previousFileSizes, warnings }) => {
        if (warnings.length) {
          console.log(chalk.yellow('Compiled with warnings.\n'));
        } else {
          console.log(chalk.green('Compiled successfully.\n'));
        }

        console.log('File sizes after gzip:\n');
        printFileSizesAfterBuild(
          stats,
          previousFileSizes,
          paths.appBuild,
          WARN_AFTER_BUNDLE_GZIP_SIZE,
          WARN_AFTER_CHUNK_GZIP_SIZE
        );
      },
      (err) => {
        const tscCompileOnError = process.env.TSC_COMPILE_ON_ERROR === 'true';
        if (tscCompileOnError) {
          console.log(
            chalk.yellow(
              'Compiled with the following type errors (you may want to check these before deploying your app):\n'
            )
          );
          printBuildError(err);
        } else {
          console.log(chalk.red('Failed to compile.\n'));
          printBuildError(err);
          process.exit(1);
        }
      }
    )
    .catch((err) => {
      if (err && err.message) {
        console.log(err.message);
      }
      process.exit(1);
    });
};
// Create the build and print the deployment instructions.
function build(config, previousFileSizes) {
  console.log(`Creating a ${Env} build...`);

  const compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages;
      if (err) {
        if (!err.message) {
          return reject(err);
        }

        let errMessage = err.message;

        // Add additional information for postcss errors
        if (Object.prototype.hasOwnProperty.call(err, 'postcssNode')) {
          errMessage += `\nCompileError: Begins at CSS selector ${err['postcssNode'].selector}`;
        }

        messages = formatWebpackMessages({
          errors: [errMessage],
          warnings: []
        });
      } else {
        messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );
      }
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            '\nTreating warnings as errors because process.env.CI = true.\n' +
              'Most CI servers set it automatically.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings
      };
      return resolve(resolveArgs);
    });
  });
}

module.exports = buildComponent;
