# API Lambdas. The api-gateway-service module supports exactly two path levels,
# /<prefix>/<part>, so ids travel in the body or query string.

locals {
  users_lambdas = [
    { name = "me", description = "Upsert and return the caller's profile", path_part = "me", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "update", description = "Set the caller's display name and photo choice", path_part = "update", http_method = "PATCH", authorization = "COGNITO_USER_POOLS" },
    { name = "avatar_upload", description = "Presign an S3 POST for one profile photo", path_part = "avatar-upload", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "get", description = "A profile with its season summary, through the gate", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "delete", description = "Delete the caller's account and everything that names them", path_part = "delete", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  scores_lambdas = [
    { name = "submit", description = "Record the caller's final answer on one performance", path_part = "submit", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "reveal_all", description = "Forfeit every performance the caller left unanswered in one episode", path_part = "reveal-all", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "skip_before", description = "Forfeit every performance the caller left unanswered in the aired episodes before one", path_part = "skip-before", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  episodes_lambdas = [
    { name = "state", description = "One episode as the caller may see it, through the gate", path_part = "state", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  groups_lambdas = [
    { name = "create", description = "Start a group with the caller as its first member", path_part = "create", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "join", description = "Join a group by invite code", path_part = "join", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "mine", description = "The caller's groups with member names and avatars", path_part = "mine", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "invite", description = "Invite a friend into a group", path_part = "invite", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "respond", description = "Accept or decline a group invite", path_part = "respond", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "manage", description = "Owner: rename, remove a member, approval, answer join requests", path_part = "manage", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "delete", description = "Owner: delete a group for everyone", path_part = "delete", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "leave", description = "Leave a group", path_part = "leave", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "shows", description = "Start or stop a show for a group, telling its members", path_part = "shows", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  seasons_lambdas = [
    { name = "get", description = "Schedule, roster, judges and headshot credits for one season", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "list", description = "Every season of a show for the season picker", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  admin_lambdas = [
    { name = "keyword", description = "Set a couple's SMS keyword override", path_part = "keyword", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "me", description = "Whether the caller is a site admin", path_part = "me", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "overview", description = "Admin dashboard: active users, signups, retention, funnel, participation", path_part = "overview", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "users", description = "Admin: every user with their recent activity", path_part = "users", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "user", description = "Admin: one user's profile, groups, friends and activity log", path_part = "user", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "events", description = "Admin: the newest activity events across every site", path_part = "events", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "audit", description = "Admin: the log of admin support actions", path_part = "audit", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "profile", description = "Admin: change someone's display name or reset their photo", path_part = "profile", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "membership", description = "Admin: add, remove, repair or re-invite someone in a group", path_part = "membership", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "friendship", description = "Admin: undo a block or friendship between two users", path_part = "friendship", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "answers", description = "Admin: one user's answers in one episode", path_part = "answers", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "answer", description = "Admin: set or clear one user's score or pick", path_part = "answer", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "delete", description = "Admin: delete someone's account through users_delete", path_part = "delete", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "view", description = "Admin: what one user sees on a screen, read-only", path_part = "view", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  # The read-only screens admin_view may invoke as a user: SCREENS in
  # backend/lambdas/admin_view/handler.py.
  admin_view_screens = ["overview_get", "users_get", "episodes_state", "stats_get", "groups_mine", "notifications_list", "leaderboard_get", "week_board_get", "performers_get", "traitors_season", "traitors_episode", "traitors_stats"]
  stats_lambdas = [
    { name = "get", description = "The caller's accuracy against the judges, and everyone's, through the gate", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  leaderboard_lambdas = [
    { name = "get", description = "Users ranked by accuracy against the judges, from per-user sums", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  overview_lambdas = [
    { name = "get", description = "The signed-in home: season progress, the caller's numbers, next episode, reveals, standings", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  friends_lambdas = [
    { name = "request", description = "Ask someone to be friends, by sub or invite code", path_part = "request", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "accept", description = "Accept a friend request", path_part = "accept", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "remove", description = "Unfriend, cancel a request, or decline one", path_part = "remove", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "block", description = "Block or unblock someone", path_part = "block", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "list", description = "The caller's friends, requests, blocks and invite code", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "search", description = "Find people by display name prefix", path_part = "search", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  notifications_lambdas = [
    { name = "list", description = "The caller's notifications, unread first, paged", path_part = "list", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "read", description = "Mark one notification read, or all", path_part = "read", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
  ]
  performers_lambdas = [
    { name = "get", description = "The caller's scores per couple, pro and celebrity against the judges, through the gate", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  week_board_lambdas = [
    { name = "get", description = "One episode's couples ranked by judges, the caller, friends and everyone, through the gate", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  people_lambdas = [
    { name = "search", description = "Users, stars, pros and judges whose name matches", path_part = "search", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "get", description = "A celebrity, pro or judge: bio, seasons, dances and numbers, through the gate", path_part = "get", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  traitors_lambdas = [
    { name = "season", description = "A Traitors season's schedule and the caller's progress, or the winner-bet roster", path_part = "season", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "episode", description = "One Traitors episode as the caller may see it, through the gate", path_part = "episode", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "pick", description = "Record the caller's final pick for one Traitors event", path_part = "pick", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "winner", description = "Record the caller's final season winner bet", path_part = "winner", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "player", description = "A Traitors player across seasons: finishes, factions and votes received, through the gate", path_part = "player", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "history", description = "A finished Traitors season: every episode's confirmed results and the winners", path_part = "history", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "ranks", description = "Users ranked by Traitors points, from per-user sums", path_part = "ranks", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "stats", description = "The caller's own Traitors points by event and episode", path_part = "stats", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "credits", description = "Who made each Traitors headshot in a season, and its license", path_part = "credits", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
    { name = "record", description = "Every Traitors call the caller may see in a season, by person, with points", path_part = "record", http_method = "GET", authorization = "COGNITO_USER_POOLS" },
  ]
  # anon is public: a signed-out visitor has no token (common/events_dynamo.py).
  events_lambdas = [
    { name = "track", description = "Store a signed-in visitor's batch of activity events", path_part = "track", http_method = "POST", authorization = "COGNITO_USER_POOLS" },
    { name = "anon", description = "Store a signed-out visitor's batch of activity events", path_part = "anon", http_method = "POST", authorization = "NONE" },
  ]
  # Public: chat apps fetch it for the link preview, and they carry no token.
  invite_lambdas = [
    { name = "preview", description = "Link-preview card for a group invite, then on to /join/", path_part = "preview", http_method = "GET", authorization = "NONE" },
  ]

  all_api_lambdas = merge(
    { for l in local.users_lambdas : "users_${l.name}" => l },
    { for l in local.scores_lambdas : "scores_${l.name}" => l },
    { for l in local.episodes_lambdas : "episodes_${l.name}" => l },
    { for l in local.seasons_lambdas : "seasons_${l.name}" => l },
    { for l in local.admin_lambdas : "admin_${l.name}" => l },
    { for l in local.stats_lambdas : "stats_${l.name}" => l },
    { for l in local.groups_lambdas : "groups_${l.name}" => l },
    { for l in local.leaderboard_lambdas : "leaderboard_${l.name}" => l },
    { for l in local.overview_lambdas : "overview_${l.name}" => l },
    { for l in local.friends_lambdas : "friends_${l.name}" => l },
    { for l in local.notifications_lambdas : "notifications_${l.name}" => l },
    { for l in local.performers_lambdas : "performers_${l.name}" => l },
    { for l in local.week_board_lambdas : "week_board_${l.name}" => l },
    { for l in local.people_lambdas : "people_${l.name}" => l },
    { for l in local.traitors_lambdas : "traitors_${l.name}" => l },
    { for l in local.invite_lambdas : "invite_${l.name}" => l },
    { for l in local.events_lambdas : "events_${l.name}" => l },
  )

  # One role per function, granted only the table actions its handler makes.
  # PutItem can still overwrite, so the conditional put in episodes_dynamo is
  # the only thing keeping an answer final. TransactWriteItems is authorized
  # per item, as PutItem or UpdateItem.
  api_tables = {
    catalog      = aws_dynamodb_table.catalog.arn
    performances = aws_dynamodb_table.performances.arn
    scores       = aws_dynamodb_table.scores.arn
    users        = aws_dynamodb_table.users.arn
    groups       = aws_dynamodb_table.groups.arn
    board        = aws_dynamodb_table.board.arn
    social       = aws_dynamodb_table.social.arn
    writeups     = aws_dynamodb_table.writeups.arn
    email        = aws_dynamodb_table.email.arn
    events       = aws_dynamodb_table.events.arn
    events_index = "${aws_dynamodb_table.events.arn}/index/*"
  }
  api_grants = {
    users_me           = ["users:UpdateItem", "social:GetItem", "social:PutItem", "social:DeleteItem"]
    scores_submit      = ["catalog:Query", "performances:Query", "scores:PutItem", "scores:GetItem", "board:PutItem", "board:UpdateItem"]
    scores_reveal_all  = ["catalog:Query", "performances:Query", "scores:Query", "scores:PutItem", "scores:GetItem"]
    episodes_state     = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query", "writeups:Query"]
    seasons_get        = ["catalog:Query", "performances:Query", "scores:Query"]
    admin_keyword      = ["catalog:UpdateItem"]
    stats_get          = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query"]
    groups_create      = ["groups:PutItem"]
    groups_join        = ["groups:GetItem", "groups:UpdateItem", "groups:PutItem", "social:PutItem"]
    groups_mine        = ["groups:Query", "users:BatchGetItem", "social:Query", "board:BatchGetItem", "groups:PutItem", "groups:UpdateItem"]
    seasons_list       = ["catalog:Query"]
    overview_get       = ["catalog:Query", "performances:Query", "scores:Query"]
    friends_request    = ["social:GetItem", "social:UpdateItem", "users:GetItem", "social:PutItem"]
    friends_accept     = ["social:UpdateItem", "social:GetItem", "social:PutItem"]
    friends_remove     = ["social:GetItem", "social:UpdateItem", "social:DeleteItem"]
    friends_block      = ["social:GetItem", "social:UpdateItem", "social:DeleteItem"]
    friends_list       = ["social:Query", "social:GetItem", "social:PutItem", "users:BatchGetItem"]
    friends_search     = ["social:Query"]
    users_update       = ["users:GetItem", "users:UpdateItem", "social:GetItem", "social:PutItem", "social:DeleteItem"]
    users_get          = ["users:GetItem", "catalog:Query", "performances:Query", "scores:Query", "groups:Query", "social:Query", "social:GetItem", "board:BatchGetItem", "board:Query", "groups:GetItem", "users:BatchGetItem"]
    leaderboard_get    = ["catalog:Query", "board:Query", "board:BatchGetItem", "groups:Query", "social:Query", "users:BatchGetItem", "performances:Query", "scores:Query"]
    notifications_list = ["social:Query", "users:BatchGetItem"]
    notifications_read = ["social:Query", "social:UpdateItem"]
    groups_invite      = ["groups:GetItem", "groups:PutItem", "social:GetItem", "social:PutItem"]
    groups_respond     = ["groups:GetItem", "groups:DeleteItem", "groups:UpdateItem", "social:UpdateItem"]
    groups_manage      = ["groups:GetItem", "groups:UpdateItem", "groups:DeleteItem", "social:PutItem", "social:UpdateItem"]
    groups_delete      = ["groups:GetItem", "groups:Query", "groups:BatchWriteItem", "groups:DeleteItem", "social:DeleteItem"]
    groups_leave       = ["groups:GetItem", "groups:DeleteItem"]
    groups_shows       = ["groups:GetItem", "groups:Query", "groups:PutItem", "groups:DeleteItem", "social:PutItem"]
    scores_skip_before = ["catalog:Query", "performances:Query", "scores:Query", "scores:PutItem"]
    performers_get     = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query", "social:Query", "board:BatchGetItem", "users:GetItem", "social:GetItem"]
    week_board_get     = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query", "social:Query"]
    people_search      = ["catalog:Query", "social:Query", "users:BatchGetItem"]
    people_get         = ["catalog:GetItem", "catalog:Query", "performances:Query", "scores:Query", "board:BatchGetItem", "social:Query", "writeups:Query"]
    traitors_season    = ["catalog:Query", "scores:Query", "scores:GetItem", "performances:Query"]
    traitors_episode   = ["catalog:Query", "performances:Query", "scores:Query", "scores:GetItem", "groups:Query", "social:Query", "users:BatchGetItem"]
    traitors_pick      = ["catalog:Query", "scores:GetItem", "scores:PutItem", "scores:Query", "performances:Query", "board:Query", "board:PutItem", "board:UpdateItem", "board:DeleteItem"]
    traitors_winner    = ["catalog:Query", "scores:GetItem", "scores:PutItem", "scores:UpdateItem"]
    traitors_player    = ["catalog:GetItem", "catalog:Query", "performances:Query", "scores:Query"]
    traitors_history   = ["catalog:Query", "performances:Query"]
    traitors_ranks     = ["catalog:Query", "board:Query", "board:BatchGetItem", "groups:Query", "social:Query", "users:BatchGetItem"]
    traitors_stats     = ["catalog:Query", "board:BatchGetItem", "board:GetItem"]
    traitors_credits   = ["catalog:Query"]
    traitors_record    = ["catalog:Query", "performances:Query", "scores:Query", "groups:Query", "social:Query", "users:BatchGetItem"]
    invite_preview     = ["groups:GetItem"]
    admin_overview     = ["events:Query", "users:Scan", "catalog:Query", "scores:Query"]
    admin_users        = ["events:Query", "users:Scan", "groups:Scan"]
    admin_user         = ["users:GetItem", "users:BatchGetItem", "events:Query", "events_index:Query", "groups:Query", "social:Query"]
    admin_events       = ["events:Query", "users:BatchGetItem"]
    admin_audit        = ["events:Query"]
    admin_profile      = ["users:GetItem", "users:UpdateItem", "social:GetItem", "social:PutItem", "social:DeleteItem", "events:PutItem"]
    admin_membership   = ["groups:GetItem", "groups:Query", "groups:PutItem", "groups:UpdateItem", "groups:DeleteItem", "social:PutItem", "social:DeleteItem", "events:PutItem"]
    admin_friendship   = ["social:GetItem", "social:UpdateItem", "social:DeleteItem", "events:PutItem"]
    admin_answers      = ["catalog:Query", "performances:Query", "scores:GetItem"]
    admin_answer       = ["catalog:Query", "performances:Query", "scores:GetItem", "scores:Query", "scores:PutItem", "scores:DeleteItem", "board:Query", "board:PutItem", "board:UpdateItem", "board:DeleteItem", "events:PutItem"]
    admin_delete       = ["users:GetItem", "events:PutItem"]
    admin_view         = ["users:GetItem"]
    events_track       = ["events:UpdateItem", "events:BatchWriteItem"]
    events_anon        = ["events:UpdateItem", "events:BatchWriteItem"]
    users_delete       = ["events:Query", "events_index:Query", "events:BatchWriteItem", "events:UpdateItem", "groups:Query", "groups:Scan", "groups:UpdateItem", "groups:DeleteItem", "groups:BatchWriteItem", "scores:Scan", "scores:BatchWriteItem", "board:Scan", "board:BatchWriteItem", "social:Scan", "social:BatchWriteItem", "social:DeleteItem", "users:DeleteItem"]
  }

  # Env a single function needs beyond lambda_variables.
  api_env = {
    users_delete = { COGNITO_USER_POOL_ID = local.cognito_user_pool_id }
    admin_delete = { COGNITO_USER_POOL_ID = local.cognito_user_pool_id }
  }

  # users_delete scans four tables for rows naming the caller; the admin reports
  # scan users and read up to 13 weeks of rollups, and API Gateway stops at 29 s.
  api_timeout = {
    users_delete   = 60
    admin_overview = 29
    admin_users    = 29
    admin_view     = 29
    admin_delete   = 75
  }

  # Object actions on the avatars bucket (avatars.tf). The presigned POST is
  # signed with the upload function's own credentials, so its PutObject is
  # what S3 checks the browser's upload against.
  avatar_grants = {
    users_avatar_upload = ["s3:PutObject"]
    users_update        = ["s3:DeleteObject"]
    admin_profile       = ["s3:DeleteObject"]
    users_delete        = ["s3:DeleteObject"]
  }
}

resource "aws_cloudwatch_log_group" "api" {
  for_each          = local.all_api_lambdas
  name              = "/aws/lambda/${var.app_name}-${replace(each.key, "_", "-")}"
  retention_in_days = 30
}

resource "aws_iam_role" "api" {
  for_each           = local.all_api_lambdas
  name               = "${var.app_name}-${replace(each.key, "_", "-")}-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "api" {
  for_each = local.all_api_lambdas

  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.api[each.key].arn}:*"]
  }

  dynamic "statement" {
    for_each = lookup(local.api_grants, each.key, [])
    content {
      actions   = ["dynamodb:${split(":", statement.value)[1]}"]
      resources = [local.api_tables[split(":", statement.value)[0]]]
    }
  }

  dynamic "statement" {
    for_each = contains(keys(local.avatar_grants), each.key) ? [1] : []
    content {
      sid       = "Avatars"
      actions   = local.avatar_grants[each.key]
      resources = ["${aws_s3_bucket.avatars.arn}/avatars/*"]
    }
  }

  # users_delete lists the caller's prefix to find photos never chosen, too.
  dynamic "statement" {
    for_each = each.key == "users_delete" ? [1] : []
    content {
      sid       = "ListAvatars"
      actions   = ["s3:ListBucket"]
      resources = [aws_s3_bucket.avatars.arn]
      condition {
        test     = "StringLike"
        variable = "s3:prefix"
        values   = ["avatars/*"]
      }
    }
  }

  # The pool belongs to xomware-infrastructure, but the grant lives on this role.
  dynamic "statement" {
    for_each = each.key == "users_delete" ? [1] : []
    content {
      sid       = "DeleteLogin"
      actions   = ["cognito-idp:AdminDeleteUser"]
      resources = [data.aws_ssm_parameter.cognito_user_pool_arn.value]
    }
  }

  # Admin handlers read the admin list on every call (common/admins.py).
  dynamic "statement" {
    for_each = startswith(each.key, "admin_") ? [1] : []
    content {
      sid       = "ReadAdmins"
      actions   = ["ssm:GetParameter"]
      resources = [aws_ssm_parameter.admin_emails.arn]
    }
  }

  # admin_view runs a read-only screen as the user; admin_delete runs users_delete.
  dynamic "statement" {
    for_each = each.key == "admin_view" ? [1] : []
    content {
      sid       = "ViewAs"
      actions   = ["lambda:InvokeFunction"]
      resources = [for k in local.admin_view_screens : aws_lambda_function.api[k].arn]
    }
  }

  dynamic "statement" {
    for_each = each.key == "admin_delete" ? [1] : []
    content {
      sid       = "DeleteAs"
      actions   = ["lambda:InvokeFunction"]
      resources = [aws_lambda_function.api["users_delete"].arn]
    }
  }

  dynamic "statement" {
    for_each = each.key == "admin_delete" ? [1] : []
    content {
      sid       = "FindLogin"
      actions   = ["cognito-idp:ListUsers"]
      resources = [data.aws_ssm_parameter.cognito_user_pool_arn.value]
    }
  }

  statement {
    sid       = "UseKey"
    actions   = ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.app.arn]
  }
}

resource "aws_iam_role_policy" "api" {
  for_each = local.all_api_lambdas
  name     = "api"
  role     = aws_iam_role.api[each.key].id
  policy   = data.aws_iam_policy_document.api[each.key].json
}

resource "aws_lambda_function" "api" {
  for_each = local.all_api_lambdas

  # Folder lambdas/users_me is function armchair-users-me: deploy-backend.yml
  # maps every underscore to a dash.
  function_name = "${var.app_name}-${replace(each.key, "_", "-")}"
  description   = each.value.description
  role          = aws_iam_role.api[each.key].arn
  handler       = "handler.handler"
  runtime       = var.lambda_runtime
  memory_size   = 1024 # CPU scales with memory; at 256 MB a cold start took ~2 s
  timeout       = try(local.api_timeout[each.key], 10)
  layers        = [aws_lambda_layer_version.lambda_layer.arn]

  filename         = "./templates/lambda_stub.zip"
  source_code_hash = filebase64sha256("./templates/lambda_stub.zip")

  environment { variables = merge(local.lambda_variables, try(local.api_env[each.key], {})) }

  depends_on = [aws_cloudwatch_log_group.api]

  # Code ownership belongs to CI after the first apply.
  lifecycle {
    ignore_changes = [description, filename, source_code_hash, layers]
  }
}
