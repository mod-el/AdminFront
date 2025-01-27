<?php namespace Model\AdminFront\Providers;

use Model\Db\AbstractDbProvider;

class DbProvider extends AbstractDbProvider
{
	public static function getMigrationsPaths(): array
	{
		return [
			[
				'path' => 'model/AdminFront/migrations',
			],
		];
	}
}
