import json

from scripts.migrate_traitors_bets import main
from tests.conftest import CATALOG_TABLE, SCORES_TABLE


def test_stamps_legacy_picks_once(aws, capsys):
    aws.Table(CATALOG_TABLE).put_item(
        Item={"pk": "SEASONS#tus", "sk": "SEASON#005", "id": "tus-5", "number": 5}
    )
    s = aws.Table(SCORES_TABLE)
    s.put_item(
        Item={
            "pk": "WIN#tus#5",
            "sk": "USER#a",
            "picks": [{"player": "cat", "faction": "Traitor"}],
            "released": 4,
        }
    )
    s.put_item(
        Item={
            "pk": "WIN#tus#5",
            "sk": "USER#b",
            "picks": [
                {"player": "cat", "faction": "Traitor", "released": 0},
                {"player": "dan", "faction": "Faithful", "released": 2},
            ],
            "released": 0,
        }
    )

    main(["--dry-run"])
    assert json.loads(capsys.readouterr().out)["seasons"]["tus-5"]["migrated"] == 1
    assert "released" not in s.get_item(Key={"pk": "WIN#tus#5", "sk": "USER#a"})["Item"]["picks"][0]

    main([])
    out = json.loads(capsys.readouterr().out)["seasons"]["tus-5"]
    assert out == {"bets": 2, "byPlaces": {"1": 1, "2": 1}, "migrated": 1}
    a = s.get_item(Key={"pk": "WIN#tus#5", "sk": "USER#a"})["Item"]
    assert a["picks"] == [{"player": "cat", "faction": "Traitor", "released": 4}]
    b = s.get_item(Key={"pk": "WIN#tus#5", "sk": "USER#b"})["Item"]
    assert b["picks"][1]["released"] == 2

    main([])
    assert json.loads(capsys.readouterr().out)["seasons"]["tus-5"]["migrated"] == 0
