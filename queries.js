import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri } from 'mu';
import groupBy from 'lodash.groupby';

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

async function destinationGraphOfSubject (subject, type, srcGraph) {
  const path = relationPathForType(type);
  const queryString = `
SELECT DISTINCT ?graph
WHERE {
    GRAPH ${sparqlEscapeUri(srcGraph)} {
        ${sparqlEscapeUri(subject)} a ${sparqlEscapeUri(type)} .
        ${sparqlEscapeUri(subject)} ${path} ?group.
    }
    VALUES (?group ?graph) {
        ( ${GROUP_MAPPINGS.map(g => sparqlEscapeUri(g.group) + ' ' + sparqlEscapeUri(g.graph)).join(')\n            (')} )
    }
}`;
  const result = await querySudo(queryString);
  const parsedResults = parseSparqlResults(result);
  return parsedResults.length ? parsedResults[0].graph : null;
}

async function graphStatementsFromQuads (quads, graph) {
  const quadsByGraph = groupBy(quads, q => q[3]);
  let graphStatements = '';
  for (const [graph, triples] of Object.entries(quadsByGraph)) {
    graphStatements += `
    GRAPH ${sparqlEscapeUri(graph)} {
        ${triples.map(t => sparqlEscapeUri(t[0]) + ' ' +
            sparqlEscapeUri(t[1]) + ' ' +
            sparqlEscapeUri(t[2]) + ' .').join('\n        ')}
    }
`;
  }
  return graphStatements;
}

async function deleteQuads (quads) {
  const graphStatements = graphStatementsFromQuads(quads);
  if (graphStatements) {
    const queryString = `
DELETE DATA {
    ${graphStatements}
}`;
    const result = await updateSudo(queryString);
    return result;
  } else {
    return null;
  }
}

async function insertQuads (quads) {
  const graphStatements = graphStatementsFromQuads(quads);
  if (graphStatements) {
    const queryString = `
INSERT DATA {
    ${graphStatements}
}`;
    const result = await updateSudo(queryString);
    return result;
  } else {
    return null;
  }
}

// assumes destination graph to be empty (not to create conflicting data)
async function redistribute (type, srcGraph) {
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
  destinationGraphOfSubject,
  deleteQuads,
  insertQuads,
  redistribute
};
