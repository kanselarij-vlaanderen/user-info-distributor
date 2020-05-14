import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';

import * as deltaUtil from './lib/delta-util';
import * as queries from './queries';
import { updateQuadsFromDeltas } from './lib/delta';

import { USER_INFO_GRAPH, WATCH_TYPES, UPDATEABLE_PREDICATES, PATH_PREDICATES } from './config';

app.post('/delta', bodyParser.json(), async (req, res) => {
  res.status(202).end();
  const insertionDeltas = deltaUtil.insertionDeltas(req.body);
  const deletionDeltas = deltaUtil.deletionDeltas(req.body);
  if (insertionDeltas.length || deletionDeltas.length) {
    console.debug(`Received deltas (${insertionDeltas.length + deletionDeltas.length} total)`);
  } else {
    return; // Empty delta message received on startup?
  }

  let deleteQuads = [];
  let insertQuads = [];
  // DELETIONS (removed user info)
  const typeDeletionDeltas = deltaUtil.filterByType(deletionDeltas, WATCH_TYPES.map(t => t.type));
  if (typeDeletionDeltas.length) {
    console.log(`Received deltas for ${typeDeletionDeltas.length} DELETED user info object(s)`);
  }
  let deletedDeltas = [];
  for (const d of typeDeletionDeltas) {
    const subject = d.subject.value;
    const type = d.object.value;
    const graph = await queries.destinationGraphOfSubject(subject, type, USER_INFO_GRAPH);
    if (graph) {
      const deletedDeltasforSubject = deltaUtil.filterBySubject(deletionDeltas, [subject]);
      deleteQuads = deleteQuads.concat(deletedDeltasforSubject.map(d => {
        return {
          subject: d.subject,
          predicate: d.predicate,
          object: d.object,
          graph: { value: graph, type: 'uri' }
        };
      }));
      deletedDeltas = deletedDeltas.concat(deletedDeltasforSubject);
    }
  }

  // INSERTIONS (new user info)
  const typeInsertionDeltas = deltaUtil.filterByType(insertionDeltas, WATCH_TYPES.map(t => t.type));
  if (typeInsertionDeltas.length) {
    console.log(`Received deltas for ${typeInsertionDeltas.length} INSERTED user info object(s)`);
  }
  let insertedDeltas = [];
  for (const d of typeInsertionDeltas) {
    const subject = d.subject.value;
    const type = d.object.value;
    const graph = await queries.destinationGraphOfSubject(subject, type, USER_INFO_GRAPH);
    if (graph) {
      const insertedDeltasforSubject = deltaUtil.filterBySubject(insertionDeltas, [subject]);
      insertQuads = insertQuads.concat(insertedDeltasforSubject.map(d => {
        return {
          subject: d.subject,
          predicate: d.predicate,
          object: d.object,
          graph: { value: graph, type: 'uri' }
        };
      }));
      insertedDeltas = insertedDeltas.concat(insertedDeltasforSubject);
    }
  }

  // UPDATES to properties (properties need updating)
  /*
   * NOTE: To avoid triggering queries for resource type on each received delta, we filter deltas
   * based on user-info related predicates in which we expect modifications. Note however that
   * updates to properties not included here, will not be picked up for user info distribution
   */
  // Filter for deltas with watched predicates only, Filter out already processed subjects
  const deleteUpdates = deltaUtil.filterByPredicate(deletionDeltas.filter(e => !deletedDeltas.includes(e)), UPDATEABLE_PREDICATES);
  if (deleteUpdates.length) {
    console.log(`Received deltas for ${deleteUpdates.length} UPDATED (deletes) *possible* user info propertie(s)`);
    deleteQuads = deleteQuads.concat(await updateQuadsFromDeltas(deleteUpdates));
  }
  const insertUpdates = deltaUtil.filterByPredicate(insertionDeltas.filter(e => !insertedDeltas.includes(e)), UPDATEABLE_PREDICATES);
  if (insertUpdates.length) {
    console.log(`Received deltas for ${insertUpdates.length} UPDATED (inserts) *possible* user info propertie(s)`);
    insertQuads = insertQuads.concat(await updateQuadsFromDeltas(insertUpdates));
  }

  // Commit changes that resulted from this delta set
  if (deleteQuads.length) {
    await queries.deleteQuads(deleteQuads);
  }
  if (insertQuads.length) {
    await queries.insertQuads(insertQuads);
  }

  // UPDATES in group path (entities need graph-moving)
  let pathUpdates = deltaUtil.filterByPredicate(deletionDeltas, PATH_PREDICATES);
  pathUpdates = pathUpdates.concat(deltaUtil.filterByPredicate(insertionDeltas, PATH_PREDICATES));
  if (pathUpdates.length) {
    console.log(`Received deltas for ${pathUpdates.length} updates in the user info group-relation path.`);
  }
  for (const d of pathUpdates) {
    const type = WATCH_TYPES.find(t => t.pathToGroup.find(p => p.uri === d.predicate.value));
    const changedPathSection = type.pathToGroup.find(p => p.uri === d.predicate.value);
    const index = type.pathToGroup.indexOf(changedPathSection);
    const prePathSection = type.pathToGroup.slice(0, index);
    const postPathSection = type.pathToGroup.slice(index + 1);
    await queries.move(d, changedPathSection.inverse, prePathSection, postPathSection, type.type, USER_INFO_GRAPH);
  }
});

/*
 * Redistribute user info from the user info graph to the destination graphs based on the users' groups
 * NOTE: Assumes the destination graphs to be empty (or not contain any user-info yet)
 */
app.post('/redistribute', async (req, res) => {
  console.log('Starting redistribution of user info');
  res.status(202).end();
  for (const type of WATCH_TYPES.map(t => t.type)) {
    console.log(`Redistributing resources of type <${type}> ...`);
    await queries.redistribute(type, USER_INFO_GRAPH);
  }
  console.log('Finished redistribution of user info');
});

app.use(errorHandler);
