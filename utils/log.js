var chalk = require('chalk');

module.exports = function(type, msg) {

    switch(type) {
        case 'e': {
            return console.error(chalk.red(`[error]: ${msg}`));
        }
        case 's': {
            return console.log(chalk.green(`[success]: ${msg}`));
        }
        case 'w': {
            return console.warn(chalk.yellow(`[warning]: ${msg}`));
        }
        case 'i': {
            return console.info(chalk.dim(`[info]: ${msg}`));
        }
        case 'd': {
            return console.debug(chalk.blue(`[debug]: ${msg}`));
        }
        default: {
            return console.log(chalk.reset(msg));
        }
    }
}