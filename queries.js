import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri } from 'mu';

import { parseSparqlResults, relationPathForType } from './lib/query-util';

import { GROUP_MAPPINGS } from './config';

async function subjectIsTypeInGraph (subject, graph, types) {
  const queryString = `
SELECT DISTINCT ?type
WHERE {
    GRAPH ${sparqlEscapeUri(graph)} {
        ${sparqlEscapeUri(subject)} a ?type .
        VALUES ?type {
            ${types.map(sparqlEscapeUri).join('\n                ')}
        }
    }
}
  `;
  const result = await querySudo(queryString);
  const parsedResults = parseSparqlResults(result);
  return parsedResults.length ? parsedResults[0].type : null;
}

async function updateInDestinationGraph (subject, type, srcGraph) {
  const path = relationPathForType(type);
  const queryString = `
DELETE {
    GRAPH ?dstGraph {
        ${sparqlEscapeUri(subject)} ?oldP ?oldO .
    }
}
INSERT {
    GRAPH ?dstGraph {
        ${sparqlEscapeUri(subject)} ?newP ?newO .
    }
}
WHERE {
    GRAPH ${sparqlEscapeUri(srcGraph)} {
        ${sparqlEscapeUri(subject)} ?newP ?newO .
        ${sparqlEscapeUri(subject)} ${path} ?group.
        VALUES (?group ?dstGraph) {
            ( ${GROUP_MAPPINGS.map(g => sparqlEscapeUri(g.group) + ' ' + sparqlEscapeUri(g.graph)).join(')\n            (')} )
        }
    }
    GRAPH ?dstGraph {
        OPTIONAL {
          ${sparqlEscapeUri(subject)} ?oldP ?oldO .
        }
    }
    FILTER ( !((?newP = ?oldP) && (?newO = ?oldO)) )
}
  `;
  const result = await updateSudo(queryString);
  return result;
}

// assumes destination graph to be empty (not to create conflicting data)
async function redistribute (srcGraph, type) {
  const path = relationPathForType(type);
  const queryString = `
INSERT {
    GRAPH ?dstGraph {
        ?newS ?newP ?newO .
        ?newIO ?newIP ?newS .
    }
}
WHERE {
    GRAPH ${sparqlEscapeUri(srcGraph)} {
        ?newS a ${sparqlEscapeUri(type)} ;
            ?newP ?newO .
        ?newIO ?newIP ?newS .
        ?newS ${path} ?group.
        VALUES (?group ?dstGraph) {
            ( ${GROUP_MAPPINGS.map(g => sparqlEscapeUri(g.group) + ' ' + sparqlEscapeUri(g.graph)).join(')\n            (')} )
        }
    }
}
  `;
  const result = await updateSudo(queryString);
  return result;
}

module.exports = {
  subjectIsTypeInGraph,
  updateInDestinationGraph,
  redistribute
};
