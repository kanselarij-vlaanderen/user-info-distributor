import * as queries from '../queries';
import { USER_INFO_GRAPH, WATCH_TYPES } from '../config';

async function updateQuadsFromDeltas (deltas) {
  const subjectGraphCache = {};
  const quads = [];
  for (const d of deltas) {
    const watchTypeConfig = WATCH_TYPES.find(t => t.predicates.find(p => p.uri === d.predicate.value));
    const predicate = watchTypeConfig.predicates.find(p => p.uri === d.predicate.value);
    const subject = predicate.inverse ? d.object.value : d.subject.value;
    let graph;
    if (subjectGraphCache[subject] !== undefined) { // From cache
      graph = subjectGraphCache[subject];
    } else { // query
      graph = await queries.destinationGraphOfSubject(subject, watchTypeConfig.type, USER_INFO_GRAPH);
      subjectGraphCache[subject] = graph;
    }
    if (graph) {
      quads.push({
        subject: d.subject,
        predicate: d.predicate,
        object: d.object,
        graph: { value: graph, type: 'uri' }
      });
    }
  }
  return quads;
}

export {
  updateQuadsFromDeltas
};
