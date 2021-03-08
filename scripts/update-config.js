/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const PROJECT_DIR_NAME = path.basename(path.dirname(__dirname));

const FILE_PATH = {
  PACKAGE_JSON: 'package.json',
  WEBPACK_CONFIG: 'webpack.config.js',
  README: 'README.md',
};

const REGEX = {
  PACKAGE_JSON: {
    NAME: /"name"[\s:]*?"(.*?)"/is,
    VERSION: /"version"[\s:]*?"(.*?)"/is,
    LICENSE: /"license"[\s:]*?"(.*?)"/is,
    DESCRIPTION: /"description"[\s:]*?"(.*?)"/is,
    KEYWORDS: /"keywords"\s*?:\s*?\[\s*?(.*?)\s*?\]/is,
    AUTHOR: /"author"[\s:]*?"(.*?)"/is,
    REPOSITORY: /"repository".*?"url"[\s:]*?"(.*?)"/is,
    BUGS: /"bugs".*?"url"[\s:]*?"(.*?)"/is,
    HOMEPAGE: /"homepage"[\s:]*?"(.*?)"/is,
  },
  WEBPACK_CONFIG: {
    HTML_TITLE: /HTML_TITLE[\s=]*?'(.*?)'/is,
    HTML_META_TITLE: /HTML_META_TITLE[\s=]*?'(.*?)'/is,
    HTML_META_DESCRIPTION: /HTML_META_DESCRIPTION[\s=]*?'(.*?)'/is,
    PUBLIC_PATH: /PUBLIC_PATH.*?PROD[\s:]*?'(.*?)'/is,
  },
};

function getGitConfigValue(name) {
  try {
    const value = execSync(`git config --get ${name}`, {
      encoding: 'utf-8',
    });
    return value.trim();
  } catch {
    return '';
  }
}

function convertProjectDirNameToTitle(projectName) {
  if (!projectName) return '';
  return projectName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function matchRegex(str, regex) {
  const match = str.match(regex);
  return match && match[1] ? match[1] : '';
}

function askQuestion(question, defaultValue, callback) {
  const defaultAnswer = defaultValue ? defaultValue.trim() : '';
  rl.question(question + ' ' + '(' + defaultAnswer + ')' + ' ', (input) => {
    const answer = input.trim().replace(/["\\]/gi, '');
    if (!answer && !defaultAnswer) {
      askQuestion(question, defaultValue, callback);
    } else if (!answer && defaultAnswer) {
      callback(defaultAnswer);
    } else {
      callback(answer);
    }
  });
}

function getUserInput(config, callback, i = 0) {
  if (i >= config.length) {
    callback();
    return;
  }

  const entry = config[i];
  askQuestion(entry.question, entry.default, (answer) => {
    entry.answer = entry.isArray
      ? answer
          .split(',')
          .map(
            (n, i, a) => `\r\n    "${n.trim()}"${i === a.length - 1 ? '' : ','}`
          )
          .join('')
      : answer;
    getUserInput(config, callback, i + 1);
  });
}

function getNewFileContent(fileContent, config) {
  return config.reduce((acc, entry) => {
    const match = fileContent.match(entry.regex);
    if (!match || !match[0] || !match[1]) return acc;
    const str = match[0].replace(match[1], entry.answer);
    return acc.replace(entry.regex, str);
  }, fileContent);
}

function reviewAndApplyConfig(filePath, newFileContent, callback) {
  console.log('About to write to ' + filePath + ':\r\n');
  console.log(newFileContent + '\r\n');
  askQuestion('Is this ok ?', '', (answer) => {
    if (['y', 'yes'].includes(answer.trim().toLowerCase())) {
      console.log('Changes applied to ' + filePath + '\r\n');
      fs.writeFileSync(filePath, newFileContent, 'utf-8');
    } else {
      console.log('Aborted: no changes made to ' + filePath + '\r\n');
    }
    if (callback) callback();
  });
}

function updatePackageJSON(callback) {
  console.log("Let's update package.json\r\n");

  const fileContent = fs.readFileSync(FILE_PATH.PACKAGE_JSON, 'utf-8');

  const gitUrl = getGitConfigValue('remote.origin.url')
    .trim()
    .replace(/\.git$/, '');

  const config = [
    {
      question: 'Package name ?',
      regex: REGEX.PACKAGE_JSON.NAME,
      default: PROJECT_DIR_NAME,
      answer: '',
    },
    {
      question: 'Version ?',
      regex: REGEX.PACKAGE_JSON.VERSION,
      default: matchRegex(fileContent, REGEX.PACKAGE_JSON.VERSION),
      answer: '',
    },
    {
      question: 'Licence ?',
      regex: REGEX.PACKAGE_JSON.LICENSE,
      default: matchRegex(fileContent, REGEX.PACKAGE_JSON.LICENSE),
      answer: '',
    },
    {
      question: 'Package description ?',
      regex: REGEX.PACKAGE_JSON.DESCRIPTION,
      default: matchRegex(fileContent, REGEX.PACKAGE_JSON.DESCRIPTION),
      answer: '',
    },
    {
      question: 'Keywords ?',
      regex: REGEX.PACKAGE_JSON.KEYWORDS,
      default: matchRegex(fileContent, REGEX.PACKAGE_JSON.KEYWORDS).replace(
        /["\s]/g,
        ''
      ),
      answer: '',
      isArray: true,
    },
    {
      question: 'Author ?',
      regex: REGEX.PACKAGE_JSON.AUTHOR,
      default: getGitConfigValue('user.name'),
      answer: '',
    },
    {
      question: 'Project GitHub URL ?',
      regex: REGEX.PACKAGE_JSON.REPOSITORY,
      default: 'git+' + gitUrl + '.git',
      answer: '',
    },
    {
      question: 'Issues tracking URL ?',
      regex: REGEX.PACKAGE_JSON.BUGS,
      default: gitUrl + '/issues',
      answer: '',
    },
    {
      question: 'Homepage URL ?',
      regex: REGEX.PACKAGE_JSON.HOMEPAGE,
      default: gitUrl + '#readme',
      answer: '',
    },
  ];

  getUserInput(config, () => {
    const newFileContent = getNewFileContent(fileContent, config);
    reviewAndApplyConfig(FILE_PATH.PACKAGE_JSON, newFileContent, callback);
  });
}

function updateWebpackConfig(callback) {
  console.log("Let's update webpack.config.js\r\n");

  const packageJsonContent = fs.readFileSync(FILE_PATH.PACKAGE_JSON, 'utf-8');
  const description = matchRegex(
    packageJsonContent,
    REGEX.PACKAGE_JSON.DESCRIPTION
  );

  const fileContent = fs.readFileSync(FILE_PATH.WEBPACK_CONFIG, 'utf-8');

  const config = [
    {
      question: 'HTML Title ?',
      regex: REGEX.WEBPACK_CONFIG.HTML_TITLE,
      default: convertProjectDirNameToTitle(PROJECT_DIR_NAME),
      answer: '',
    },
    {
      question: 'HTML Meta Title ?',
      regex: REGEX.WEBPACK_CONFIG.HTML_META_TITLE,
      default: convertProjectDirNameToTitle(PROJECT_DIR_NAME),
      answer: '',
    },
    {
      question: 'HTML Meta Description ?',
      regex: REGEX.WEBPACK_CONFIG.HTML_META_DESCRIPTION,
      default: description,
      answer: '',
    },
    {
      question: 'Webpack production public path ?',
      regex: REGEX.WEBPACK_CONFIG.PUBLIC_PATH,
      default: '/' + PROJECT_DIR_NAME + '/',
      answer: '',
    },
  ];

  getUserInput(config, () => {
    const newFileContent = getNewFileContent(fileContent, config);
    reviewAndApplyConfig(FILE_PATH.WEBPACK_CONFIG, newFileContent, callback);
  });
}

function updateReadMe(callback) {
  console.log("Let's update README.md\r\n");

  const packageJsonContent = fs.readFileSync(FILE_PATH.PACKAGE_JSON, 'utf-8');
  const name = matchRegex(packageJsonContent, REGEX.PACKAGE_JSON.NAME);
  const description = matchRegex(
    packageJsonContent,
    REGEX.PACKAGE_JSON.DESCRIPTION
  );

  const newFileContent = `# ${name}\r\n${description}`;

  reviewAndApplyConfig(FILE_PATH.README, newFileContent, callback);
}

function main() {
  console.log(
    'This utility will walk you through updating the package.json and webpack.config.js files.'
  );
  console.log(
    'It covers the most common items, and tries to guess sensible defaults.'
  );
  console.log(
    "The ' \" ' and ' \\ ' characters will be escaped in the answers provided.\r\n"
  );
  console.log('Press ^C at any time to quit.\r\n');

  updatePackageJSON(() => {
    updateWebpackConfig(() => {
      updateReadMe(() => {
        rl.close();
      });
    });
  });
}

main();
