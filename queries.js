import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { sparqlEscape, sparqlEscapeUri } from 'mu';
import groupBy from 'lodash.groupby';

import { parseSparqlResults, constructRelationPath, relationPathForType } from './lib/query-util';

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

function graphStatementsFromQuads (quads, graph) {
  const quadsByGraph = groupBy(quads, q => q.graph.value);
  let graphStatements = '';
  for (const [graph, triples] of Object.entries(quadsByGraph)) {
    graphStatements += `
    GRAPH ${sparqlEscapeUri(graph)} {
        ${triples.map(t => sparqlEscape(t.subject.value, t.subject.type) + ' ' +
            sparqlEscape(t.predicate.value, t.predicate.type) + ' ' +
            sparqlEscape(t.object.value, t.object.type) + ' .').join('\n        ')}
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

async function move (changedTriple, pathIsInverse, prePathSection, postPathSection, type, srcGraph) {
  const sectionSubject = pathIsInverse ? sparqlEscapeUri(changedTriple.object.value) : sparqlEscapeUri(changedTriple.subject.value);
  const sectionObject = pathIsInverse ? sparqlEscapeUri(changedTriple.subject.value) : sparqlEscapeUri(changedTriple.object.value);

  let pathSubject; // Subject of the path section that changed
  let prePathQuerySnippet;
  if (prePathSection.length) { // set prePathQuerySnippet
    pathSubject = '?newS';
    prePathQuerySnippet = `${pathSubject} ${constructRelationPath(prePathSection)} ${sectionSubject} .`;
  } else {
    pathSubject = sectionSubject;
  }

  const changedPathSection = { uri: changedTriple.predicate.value, inverse: pathIsInverse };
  const sectionPredicate = constructRelationPath([changedPathSection]); // Predicate-like statement

  let pathObject;
  let postPathQuerySnippet;

  if (postPathSection.length) {
    pathObject = '?group';
    postPathQuerySnippet = `${sectionObject} ${constructRelationPath(postPathSection)} ${pathObject} .`;
  } else {
    pathObject = sectionObject;
  }

  const queryString = `
DELETE {
    GRAPH ?graphs {
        ${pathSubject} ?newP ?newO .
        ?newIO ?newIP ${pathSubject} .
    }
}
INSERT {
    GRAPH ?dstGraph {
        ${pathSubject} ?newP ?newO .
        ?newIO ?newIP ${pathSubject} .
    }
}
WHERE {
    GRAPH ${sparqlEscapeUri(srcGraph)} {
        ${pathSubject} a ${sparqlEscapeUri(type)} ;
            ?newP ?newO .
        ?newIO ?newIP ${pathSubject} .
        
        ${prePathQuerySnippet || ''}
        ${sectionSubject} ${sectionPredicate} ${sectionObject} .
        ${postPathQuerySnippet || ''}

        ${pathObject !== '?group' ? `BIND( ${pathObject} AS ?group )` : ''}
        VALUES (?group ?dstGraph) {
            ( ${GROUP_MAPPINGS.map(g => sparqlEscapeUri(g.group) + ' ' + sparqlEscapeUri(g.graph)).join(')\n            (')} )
        }
    }
    VALUES ?graphs {
        ${GROUP_MAPPINGS.map(m => sparqlEscapeUri(m.graph)).join('\n        ')}
    }
}
  `;
  const result = await updateSudo(queryString);
  return result;
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
  move,
  redistribute
};
