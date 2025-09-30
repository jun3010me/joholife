#!/usr/bin/env python3
import os
import yaml
from pathlib import Path

questions_dir = Path('public/questions')
output_file = questions_dir / 'index.yaml'

# 元のindex.yamlから順序を取得
with open(output_file, 'r', encoding='utf-8') as f:
    old_index = yaml.safe_load(f)
    question_set_order = old_index['questionSets']

question_sets = []

for set_id in question_set_order:
    yaml_file = questions_dir / set_id / 'questions.yaml'

    if yaml_file.exists():
        try:
            with open(yaml_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)

                question_set = {
                    'id': data.get('id', set_id),
                    'title': data.get('title', set_id),
                    'description': data.get('description', ''),
                    'icon': data.get('icon', '📝'),
                    'difficulty': data.get('difficulty', 'medium'),
                    'estimatedTime': data.get('estimatedTime', 10),
                    'category': data.get('category', '一般')
                }

                question_sets.append(question_set)
                print(f"✓ {set_id}: {question_set['title']}")
        except Exception as e:
            print(f"✗ {set_id}: Error - {e}")
    else:
        print(f"✗ {set_id}: questions.yaml not found")

# 新しいindex.yamlを生成
output_data = {'questionSets': question_sets}

with open(output_file, 'w', encoding='utf-8') as f:
    yaml.dump(output_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

print(f"\n✓ Generated {output_file} with {len(question_sets)} question sets")