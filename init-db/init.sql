RESTORE DATABASE StackOverflow2013
FROM DISK = '/var/opt/mssql/backup/StackOverflow2013.bak'
WITH MOVE 'StackOverflow2013_1' TO '/var/opt/mssql/data/StackOverflow2013_1.mdf',
     MOVE 'StackOverflow2013_2' TO '/var/opt/mssql/data/StackOverflow2013_2.ndf',
     MOVE 'StackOverflow2013_3' TO '/var/opt/mssql/data/StackOverflow2013_3.ndf',
     MOVE 'StackOverflow2013_4' TO '/var/opt/mssql/data/StackOverflow2013_4.ndf',
     MOVE 'StackOverflow2013_log' TO '/var/opt/mssql/data/StackOverflow2013_log.ldf',
     REPLACE;
GO
