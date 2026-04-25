Building a visual database and visualization tool to measure global instability.




##Necessary steps
# Create a local directory to hold the database files permanently
mkdir -p ~/globinstdash/db_data

# Spin up the new container with ports and volumes mapped
docker run --name globinst-db \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=YourPasswordPLZChange \
  -e POSTGRES_DB=instability_db \
  -p 5432:5432 \
  -v ~/globinstdash/db_data:/var/lib/postgresql/data \
  -d postgis/postgis
