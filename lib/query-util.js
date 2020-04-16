import { sparqlEscapeUri } from 'mu';

import { WATCH_TYPES } from '../config';

const parseSparqlResults = (data) => {
  if (!data) return;
  const vars = data.head.vars;
  return data.results.bindings.map((binding) => {
    const obj = {};
    vars.forEach((varKey) => {
      if (binding[varKey]) {
        obj[varKey] = binding[varKey].value;
      }
    });
    return obj;
  });
};

const constructRelationPath = function (pathArray) {
  const sparqlPath = pathArray.map(p => {
    let uri = sparqlEscapeUri(p.uri);
    if (p.inverse) {
      uri = '^' + uri;
    }
    return uri;
  });
  return sparqlPath.join(' / ');
};

const relationPathForType = function (type) {
  const pathDescription = WATCH_TYPES.find(t => t.type === type).pathToGroup;
  return constructRelationPath(pathDescription);
};

export {
  parseSparqlResults,
  relationPathForType
};
