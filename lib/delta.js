import * as queries from '../queries';
import { WATCH_TYPES } from '../config';

async function updateQuadsFromDeltas (deltas) {
  const subjectGraphCache = {};
  const quads = [];
  for (const d of deltas) {
    const watchTypeConfig = WATCH_TYPES.find(t => t.predicates.includes(p => p.uri === d.predicate.value));
    const predicate = watchTypeConfig.find(p => p.uri === d.predicate.value);
    const subject = predicate.inverse ? d.object.value : d.subject.value;
    let graph;
    if (subjectGraphCache[subject] !== undefined) { // From cache
      graph = subjectGraphCache[subject];
    } else { // query
      graph = await queries.destinationGraphOfSubject(subject, watchTypeConfig.type);
      subjectGraphCache[subject] = graph;
    }
    if (graph) {
      quads.push([d.subject.value, d.predicate.value, d.object.value, graph]);
    }
  }
  return quads;
}

export {
  updateQuadsFromDeltas
};
