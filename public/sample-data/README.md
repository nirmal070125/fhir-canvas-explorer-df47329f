# Sample FHIR R4 patient bundles

10 synthetic patients, ~3,500 FHIR resources total. Each `patient-NN.json` is a
FHIR R4 **transaction Bundle**; the explorer's "Load sample data" button POSTs
each one to the configured server's base URL.

Generated with [Synthea](https://github.com/synthetichealth/synthea) (Apache 2.0).
Synthea options used:
```
-p 10 Massachusetts
  --exporter.fhir.use_us_core_ig false
  --exporter.hospital.fhir.export false
  --exporter.practitioner.fhir.export false
  --exporter.years_of_history 5
```

US Core profile extensions are disabled so the bundles validate against a
vanilla FHIR R4 server. Hospital/practitioner bundles are skipped so each file
is a single self-contained patient transaction.

To regenerate:
```sh
git clone --depth 1 https://github.com/synthetichealth/synthea
cd synthea
./run_synthea -p 10 Massachusetts \
  --exporter.fhir.use_us_core_ig false \
  --exporter.hospital.fhir.export false \
  --exporter.practitioner.fhir.export false \
  --exporter.years_of_history 5
# Then copy output/fhir/*.json into this directory and rebuild manifest.json.
```
