export HOME=/home/bailo/

HOST=localhost

# DB name
DBNAME=bailo

# S3 bucket name
BUCKET=las-bailo

# Linux user account
USER=twest6

# Current time
TIME=`/bin/date +%d-%m-%Y-%T`

# Backup directory
DEST=/home/$USER/tmp

# Tar file of backup directory
TAR=$DEST/../$TIME.tar

# Create backup dir (-p to avoid warning if already exists)
/bin/mkdir -p $DEST

# Log
echo "Backing up $HOST/$DBNAME to s3://$BUCKET/ on $TIME";

# Dump from mongodb host into backup directory
/usr/local/bin/docker-compose exec -T mongo sh -c 'mongodump -d $DBNAME --archive' > $DEST/bailoDb.dump

if test -f "$DEST/bailoDb.dump"; then
    # Create tar of backup directory
    /bin/tar cvf $TAR -C $DEST .
else
    echo "No mongo dump created, backup failed."
    return;
fi

if test -f "$TAR"; then
    # Upload tar to s3
    /usr/bin/aws s3 cp $TAR s3://$BUCKET/backups/mongodb/ --storage-class STANDARD_IA

    # Remove tar file locally
    /bin/rm -f $TAR
else 
    echo "No tar backup found by the name of: $TAR, backup failed."
    return;
fi


# Remove backup directory
/bin/rm -rf $DEST

# All done
echo "Backup available at https://s3.amazonaws.com/$BUCKET/$TIME.tar"