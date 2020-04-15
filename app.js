import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';

import * as delta from './lib/delta';
import * as queries from './queries';

import { USER_INFO_GRAPH, WATCH_TYPES, UPDATEABLE_PREDICATES } from './config';

app.post('/delta', bodyParser.json(), async (req, res) => {
  res.status(202).end();
  const insertionDeltas = delta.insertionDeltas(req.body);
  const deletionDeltas = delta.deletionDeltas(req.body);
  console.debug(`Received deltas (${insertionDeltas.length + deletionDeltas.length} total)`);

  // DELETIONS (removed user info)
  const typeDeletionDeltas = delta.filterByType(deletionDeltas, WATCH_TYPES);
  if (typeDeletionDeltas.length) {
    console.log(`Received deltas for ${typeDeletionDeltas.length} DELETED user info object(s)`);
  }
  let deletedDeltas = [];
  for (const d of typeDeletionDeltas) {
    const subject = d.subject.value;
    const type = d.object.value;
    console.log(`Removing user info for <${subject}> (<${type}>) from destination graph ...`);
    const graph = await queries.destinationGraphOfSubject(subject, type);
    if (graph) {
      const deletedDeltasforSubject = delta.filterBySubject(deletionDeltas, [subject]);
      await queries.deleteInGraph(deletedDeltas, graph);
      deletedDeltas = deletedDeltas.join(deletedDeltasforSubject);
    }
  }

  // INSERTIONS (new user info)
  const typeInsertionDeltas = delta.filterByType(insertionDeltas, WATCH_TYPES);
  if (typeInsertionDeltas.length) {
    console.log(`Received deltas for ${typeInsertionDeltas.length} INSERTED user info object(s)`);
  }
  let insertedDeltas = [];
  for (const d of typeInsertionDeltas) {
    const subject = d.subject.value;
    const type = d.object.value;
    console.log(`Inserting user info for <${subject}> (<${type}>) in destination graph ...`);
    const graph = await queries.destinationGraphOfSubject(subject, type);
    if (graph) {
      const insertedDeltasforSubject = delta.filterBySubject(deletionDeltas, [subject]);
      await queries.insertInGraph(insertedDeltas, graph);
      insertedDeltas = insertedDeltas.join(insertedDeltasforSubject);
    }
  }

  // UPDATES (modified user info)
  /*
   * NOTE: To avoid triggering queries for resource type on each received delta, we filter deltas
   * based on user-info related predicates in which we expect modifications. Note however that
   * updates to properties not included here, will not be picked up for user info distribution
   */
  let updateDeltas = delta.filterByPredicate([...insertionDeltas, ...deletionDeltas], UPDATEABLE_PREDICATES);
  // Filter out already processed subjects
  updateDeltas = updateDeltas.filter(e => !(insertedDeltas.includes(e) || deletedDeltas.includes(e)));
  const updateSubjects = delta.uniqueSubjects(updateDeltas);
  if (updateSubjects.length) {
    console.log(`Received deltas for ${updateSubjects.length} potentially UPDATED user info object(s)`);
  }
  for (const subject of updateSubjects) {
    const type = await queries.subjectIsTypeInGraph(subject, USER_INFO_GRAPH, WATCH_TYPES.map(t => t.type));
    if (type) {
      const updatedDeltasforSubject = delta.filterBySubject(updateDeltas, [subject]);
      const graph = await queries.destinationGraphOfSubject(subject, type);
      if (graph) {
        console.log(`Updating user info for <${subject}> (<${type}>) in destination graph ...`);
        await queries.deleteInGraph(updatedDeltasforSubject, graph);
        await queries.insertInGraph(updatedDeltasforSubject, graph);
      }
    }
    // TODO if object of to-watch predicate is a of a to-watch type
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
