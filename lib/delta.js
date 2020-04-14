function deletionDeltas (deltaBody) {
  return deltaBody.map(d => d.deletes).reduce((ds, d) => Array.prototype.join.apply(ds, d));
}

function insertionDeltas (deltaBody) {
  return deltaBody.map(d => d.deletes).reduce((ds, d) => Array.prototype.join.apply(ds, d));
}

function uniqueDeltaSubjects (deltaArray) {
  const subjects = deltaArray.map(d => d.subject.value); // Also "object" for inverse relationship?
  const uniqueSubjects = [...new Set(subjects)];
  return uniqueSubjects;
}

function filterTypeDeltas (deltaArray, types) {
  deltaArray.filter(d => {
    return d.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
      types.includes(d.object.value);
  });
}

function filterPredicateDeltas (deltaArray, predicates) {
  deltaArray.filter(d => predicates.includes(d.predicate.value));
}

export {
  deletionDeltas,
  insertionDeltas,
  uniqueDeltaSubjects,
  filterTypeDeltas,
  filterPredicateDeltas
};
