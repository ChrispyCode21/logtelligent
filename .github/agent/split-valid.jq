# Checks a split proposal (PIPELINE.md, "Triage"): 2-8 sub-issues, each blocked only by ones
# listed before it (1-based, no repeats, so no cycles), and no HTML comments anywhere, since those
# wouldn't show in the proposal the owner approves. Used on triage's result and again on the data
# read back from the posted proposal.
(.subissues | type == "array" and length >= 2 and length <= 8)
and ([.subissues | to_entries[] | .key as $i | .value.blocked_by
      | (length == (unique | length)) and all(.[]; type == "number" and . == floor and . >= 1 and . <= $i)] | all)
and ([.subissues[] | .title, .body] | all(type == "string" and length > 0))
and ([(.comment // ""), (.subissues[] | .title, .body)] | all(contains("<!--") | not))
