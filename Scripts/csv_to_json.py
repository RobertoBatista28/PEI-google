import csv
import json
from decimal import Decimal

def csv_to_json(csv_path, json_path, metadata_path):
    with open(metadata_path, encoding='utf-8') as f:
        metadata = json.load(f)

    int_fields = []
    float_fields = []
    str_fields = []

    for col in metadata['columns']:
        if col['type'].lower() in ['integer', 'int']:
            int_fields.append(col['name'])
        elif col['type'].lower() in ['decimal', 'float', 'double']:
            float_fields.append(col['name'])
        else:
            str_fields.append(col['name'])

    data = []
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=';')
        for row in reader:
            document = {}
            for col in reader.fieldnames:
                val = row[col].strip()
                if col in int_fields:
                    document[col] = int(val) if val else 0
                elif col in float_fields:
                    document[col] = float(val) if val else 0.0
                else:
                    document[col] = val
            data.append(document)

    # Guardar JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print(f"JSON gerado: {json_path}")


if __name__ == "__main__":
    csv_to_json(
        csv_path='Urgencia.csv',
        json_path='Urgencia.json',
        metadata_path='Urgencia_metadata.json'
    )
