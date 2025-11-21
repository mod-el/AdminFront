<?php namespace Model\AdminFront\Providers;

use Model\Router\AbstractRouterProvider;

class RouterProvider extends AbstractRouterProvider
{
	public static function getRoutes(): array
	{
		$adminConfigClass = new \Model\Admin\Config();
		$adminCache = $adminConfigClass->buildCache();

		$routes = [];
		foreach (($adminCache['macro'] ?? []) as $path) {
			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/login',
				'controller' => 'AdminLogin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/logout',
				'controller' => 'AdminLogin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/sw.js',
				'controller' => 'AdminServiceWorker',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/get-user-customization',
				'controller' => 'Admin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/template',
				'controller' => 'Admin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/export',
				'controller' => 'Admin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/save-dashboard-layout',
				'controller' => 'Admin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/save-user-customization',
				'controller' => 'Admin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/') . '/delete-user-customization',
				'controller' => 'Admin',
			];

			$routes[] = [
				'pattern' => ltrim($path ?? '', '/'),
				'controller' => 'Admin',
			];
		}

		foreach (($adminCache['rules'] ?? []) as $path) {
			$routes[] = [
				'pattern' => ltrim($path ?? '', '/'),
				'controller' => 'Admin',
			];
		}

		return $routes;
	}
}
