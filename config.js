// Also see projects' config/authorization/config.ex file for more info
const USER_INFO_GRAPH = process.env.MU_APPLICATION_USER_INFO_GRAPH || 'http://mu.semte.ch/graphs/account-info';

const WATCH_TYPES = [
  {
    type: 'http://xmlns.com/foaf/0.1/Person',
    pathToGroup: [
      { uri: 'http://xmlns.com/foaf/0.1/member', inverse: true }
    ],
    predicates: [ // Doesn't contain all predicates. Just the ones we expect to get updated
      { uri: 'http://xmlns.com/foaf/0.1/firstName', inverse: false },
      { uri: 'http://xmlns.com/foaf/0.1/familyName', inverse: false },
      { uri: 'http://xmlns.com/foaf/0.1/mbox', inverse: false },
      { uri: 'http://xmlns.com/foaf/0.1/phone', inverse: false },
      { uri: 'http://www.w3.org/ns/org#memberOf', inverse: false },
      { uri: 'http://xmlns.com/foaf/0.1/member', inverse: true },
      { uri: 'http://xmlns.com/foaf/0.1/account', inverse: false } // No real "updates", but login-service doesn't insert user and account in one transaction
    ]
  },
  {
    type: 'http://xmlns.com/foaf/0.1/OnlineAccount',
    pathToGroup: [
      { uri: 'http://xmlns.com/foaf/0.1/account', inverse: true },
      { uri: 'http://xmlns.com/foaf/0.1/member', inverse: true }
    ],
    predicates: []
  },
  {
    type: 'http://www.w3.org/ns/adms#Identifier',
    pathToGroup: [
      { uri: 'http://www.w3.org/ns/adms#identifier', inverse: true },
      { uri: 'http://xmlns.com/foaf/0.1/member', inverse: true }
    ],
    predicates: []
  }
];

// Also see projects' config/authorization/config.ex file for more info
const GROUP_MAPPINGS = [
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/admin',
    graph: 'http://mu.semte.ch/graphs/admins'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/kanselarij',
    graph: 'http://mu.semte.ch/graphs/organizations/kanselarij'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/minister',
    graph: 'http://mu.semte.ch/graphs/organizations/minister'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/kabinet',
    graph: 'http://mu.semte.ch/graphs/organizations/kabinet'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/adviesverlener',
    graph: 'http://mu.semte.ch/graphs/organizations/adviesverlener'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/administratie',
    graph: 'http://mu.semte.ch/graphs/organizations/administratie'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/parlement',
    graph: 'http://mu.semte.ch/graphs/organizations/parlement'
  },
  {
    group: 'http://data.kanselarij.vlaanderen.be/id/group/user',
    graph: 'http://mu.semte.ch/graphs/rightless-user'
  }
];

const UPDATEABLE_PREDICATES = WATCH_TYPES.map(t => t.predicates).reduce((ps, t) => ps.concat(t)).map(p => p.uri);

const PATH_PREDICATES = WATCH_TYPES.map(t => t.pathToGroup).reduce((ps, t) => ps.concat(t)).map(p => p.uri);

module.exports = {
  USER_INFO_GRAPH,
  WATCH_TYPES,
  GROUP_MAPPINGS,
  UPDATEABLE_PREDICATES,
  PATH_PREDICATES
};
