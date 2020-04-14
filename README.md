# User info distibution service
The [ACM-IDM login service](https://github.com/kanselarij-vlaanderen/acmidm-login-service) inserts user-info in one fixed graph. Since our [access control](https://github.com/mu-semtech/mu-authorization) is graph based, we cannot restrict users from seeing data that doesn't concern them through configuration alone. This service "listens" for changes on the login-service graph and distributes the users' info to the grapg according to their respective user group. 

## Configuration
The graph to read from (the one the login service writes to) can be configured through `MU_APPLICATION_USER_INFO_GRAPH`. Most other configuration is hard-coded in `config.js`.

## Available requests

#### POST /delta

Internal endpoint for receiving deltas from the [delta-notifier](https://github.com/mu-semtech/delta-notifier)


#### POST /redistribute

Internal endpoint to manually trigger redistribution of all user info from the login-service graph to the target user-organization graphs.
