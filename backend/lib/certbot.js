const dnsPlugins = require('../global/certbot-dns-plugins.json');
const utils      = require('./utils');
const error      = require('./error');
const logger     = require('../logger').certbot;
const batchflow  = require('batchflow');

const CERTBOT_VERSION_REPLACEMENT = '$(certbot --version | grep -Eo \'[0-9](\\.[0-9]+)+\')';

const certbot = {

	/**
	 * @param {array} pluginKeys
	 */
	installPlugins: async (pluginKeys) => {
		let hasErrors = false;

		return new Promise((resolve, reject) => {
			if (pluginKeys.length === 0) {
				resolve();
				return;
			}

			batchflow(pluginKeys).sequential()
				.each((_i, pluginKey, next) => {
					certbot.installPlugin(pluginKey)
						.then(() => {
							next();
						})
						.catch((err) => {
							hasErrors = true;
							next(err);
						});
				})
				.error((err) => {
					logger.error(err.message);
				})
				.end(() => {
					if (hasErrors) {
						reject(new error.CommandError('Some plugins failed to install. Please check the logs above', 1));
					} else {
						resolve();
					}
				});
		});
	},

	/**
	 * Installs a cerbot plugin given the key for the object from
	 * ../global/certbot-dns-plugins.json
	 *
	 * @param   {string}  pluginKey
	 * @returns {Object}
	 */
	installPlugin: async (pluginKey) => {
		if (typeof dnsPlugins[pluginKey] === 'undefined') {
			// throw Error(`Certbot plugin ${pluginKey} not found`);
			throw new error.ItemNotFoundError(pluginKey);
		}

		const plugin = dnsPlugins[pluginKey];
		logger.start(`Installing ${pluginKey}...`);

		plugin.version      = plugin.version.replace(/{{certbot-version}}/g, CERTBOT_VERSION_REPLACEMENT);
		plugin.dependencies = plugin.dependencies.replace(/{{certbot-version}}/g, CERTBOT_VERSION_REPLACEMENT);

		// SETUPTOOLS_USE_DISTUTILS is required for certbot plugins to install correctly
		// in new versions of Python
		let env = Object.assign({}, process.env, {SETUPTOOLS_USE_DISTUTILS: 'stdlib'});
		if (typeof plugin.env === 'object') {
			env = Object.assign(env, plugin.env);
		}

		const cmd = `. /opt/certbot/bin/activate && pip install --no-cache-dir ${plugin.dependencies} ${plugin.package_name}${plugin.version}  && deactivate`;
		return utils.exec(cmd, {env})
			.then((result) => {
				logger.complete(`Installed ${pluginKey}`);
				return result;
			})
			.catch((err) => {
				throw err;
			});
	},
};

module.exports = certbot;
