import json

with open('jax.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

seen = set()
unique_data = []
duplicates = []

for item in data:
    key = item['en'].strip().lower()
    if key in seen:
        duplicates.append(item['en'])
    else:
        seen.add(key)
        unique_data.append(item)

print("重复的单词：")
for d in sorted(set(duplicates)):
    print(f"  - {d}")

with open('jax_deduped.json', 'w', encoding='utf-8') as f:
    json.dump(unique_data, f, ensure_ascii=False, indent=2)

print(f"\n原始条目数：{len(data)}")
print(f"去重后条目数：{len(unique_data)}")
print(f"删除重复条目数：{len(data) - len(unique_data)}")
print("已输出去重后的文件：jax_deduped.json")